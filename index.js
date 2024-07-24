const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios'); 
const prisma = new PrismaClient();
const app = express();
const generateRandomEmuCode = require('./emuCodeGenerator');

app.use(express.json());


// QPay token fetching API
const getQPayToken = async () => {
  const username = process.env.QPAY_USERNAME;
  const password = process.env.QPAY_PASSWORD;



  const authString = Buffer.from(`${username}:${password}`).toString('base64');
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`,
    },
  };

  try {
    const response = await axios.post(
      'https://merchant.qpay.mn/v2/auth/token',
      {}, // Empty body since the token request does not require a body
      config
    );
    return response.data.access_token;
  } catch (error) {
    throw new Error('Error fetching QPay token: ' + (error.response ? error.response.data : error.message));
  }
};

app.post('/qpay/token', async (req, res) => {
  try {
    const token = await getQPayToken();
    res.status(200).json({ access_token: token });
  } catch (error) {
    console.error('Error fetching QPay token:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
    });
  }
});
// Invoice creation endpoint
app.post('/qpay/invoice', async (req, res) => {
  const { token, bookingId, amount, description, service, userId } = req.body;
  const invoice_code = process.env.INVOICE_CODE;
  const base_url = process.env.BASE_URL; // Ensure you have this environment variable set to your application's base URL
  const callback_url = `https://d381-202-70-37-32.ngrok-free.app/qpay/callback/${bookingId}`;
  const sender_invoice_no = bookingId.toString();

  try {
    console.log("Entering try block in qpay invoice");
    // Fetch user details from the database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        userName: true,
        email: true,
        phoneNumber: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.log(user, "User found in qpay invoice");

    // Construct the invoice receiver data
    const invoice_receiver_data = {
      name: user.userName,
      email: user.email,
      phone: user.phoneNumber,
    };

    console.log(invoice_receiver_data, "Invoice receiver data");
    console.log(invoice_code, "Invoice code");
    console.log(sender_invoice_no, "Sender invoice no");
    console.log(service, "Service");
    console.log(description, "Description");
    console.log(callback_url, "Callback URL");
    console.log(amount, "Amount");
    console.log(token, "Token");

    // Send the request to QPay
    const response = await axios.post('https://merchant.qpay.mn/v2/invoice', {
      invoice_code,
      sender_invoice_no,
      invoice_receiver_code: "EJA",
      sender_branch_code: service,
      amount,
      invoice_description: description,
      callback_url,
      sender_staff_code: 'online',
      invoice_receiver_data
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(response.data, "Response from QPay");
    const invoiceId = response.data.invoice_id;
    console.log(invoiceId, "Invoice ID from QPay");

    const newInvoice = await prisma.qPayInvoice.create({
      data: {
        invoiceId,
        bookingId,
        status: 'pending',
        amount,
        callbackUrl: callback_url,
      },
    });

    console.log(newInvoice, "New invoice created in database");
    const paymentDetail = newInvoice.id.toString();
    console.log(paymentDetail, "Payment detail");

    // Update booking with the new QPayInvoice
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        qpayInvoices: {
          connect: { id: newInvoice.id },
        },
        paymentDetail,
      },
    });

    res.status(200).json({ invoiceId, qrCode: response.data });
  } catch (error) {
    console.error('Error creating QPay invoice:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Error creating QPay invoice' });
  }
});

// Callback endpoint
app.get('/qpay/callback/:id', async (req, res) => {
  console.log("handleQPayCallback called");
  const { id } = req.params; // 'id' will be from the dynamic route segment
  console.log("Booking ID:", id);

  if (!id) {
    console.log("Booking ID is missing");
    return res.status(400).json({ error: "Booking ID is required" });
  }

  try {
    const invoice = await prisma.qPayInvoice.findFirst({
      where: { bookingId: parseInt(id) }, // Ensure bookingId is an integer
    });
    console.log("Fetched invoice:", invoice);

    if (!invoice) {
      console.log("Invoice not found for bookingId:", id);
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Construct the object to check the payment status
    const obj = {
      object_type: "INVOICE",
      object_id: invoice.invoiceId,
    };

    // Fetch the QPay token
    const token = await getQPayToken();
    console.log("QPay token:", token);

    // Perform the necessary operations with the QPay token
    const checkPaymentResponse = await axios.post(
      "https://merchant.qpay.mn/v2/payment/check",
      obj,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Check payment response:", checkPaymentResponse.data);

    // Extract payment status from response
    const paymentStatus = checkPaymentResponse.data.rows[0].payment_status;
    if (invoice.amount === checkPaymentResponse.data.paid_amount) {
      const updatedBooking = await prisma.booking.update({
        where: { id: parseInt(id) }, // Ensure id is an integer
        data: { status: 'paid' },
      });
      console.log("Updated booking:", updatedBooking);
      // You can also update the QPay invoice status here if needed
      // const updateQpay = await prisma.qPayInvoice.update({
      //   where: { id: invoice.id },
      //   data: { status: 'paid' },
      // });
    }

    res.status(200).json({ message: "Payment status updated successfully" });
  } catch (error) {
    console.error(
      "Error handling QPay callback:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ error: "Error handling QPay callback" });
  }
});

//  fetch users
app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Example route to create a new user with hashed password
app.post('/users', async (req, res) => {
  try {
    const { email, userName, phoneNumber, password } = req.body;

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({
      data: {
        email,
        userName,
        phoneNumber,
        password: hashedPassword
      },
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to update user information
app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, userName, phoneNumber, password } = req.body;

    // Find the user by ID
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id, 10) }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare data to update
    const data = {
      email,
      userName,
      phoneNumber,
    };

    // If password is provided, hash it before saving
    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      data.password = hashedPassword;
    }

    // Update user information
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id, 10) },
      data
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route to handle user login
app.post('/login', async (req, res) => {
  try {
    const { emailOrPhoneNumber, password } = req.body;

    console.log('Received login request:', { emailOrPhoneNumber, password });

    // Find the user by email or phone number
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrPhoneNumber },
          { phoneNumber: emailOrPhoneNumber }
        ]
      }
    });

    if (!user) {
      console.log('User not found for:', emailOrPhoneNumber);
      return res.status(404).json({ error: 'User not found' });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log('Invalid password for user:', emailOrPhoneNumber);
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.SECRET_KEY, { expiresIn: '1h' });

    // Return the token
    res.json({ message: 'Login successful', token, user });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route to fetch carwashes
app.get('/carwashes', async (req, res) => {
  try {
    const carwashes = await prisma.carwash.findMany();
    res.json(carwashes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to create a new carwash
app.post('/carwashes', async (req, res) => {
  try {
    const { location, description, address, capacity, phoneNumber, name, province, imageUrl, stars } = req.body;
    const carwash = await prisma.carwash.create({
      data: {
        location,
        description,
        address,
        capacity,
        phoneNumber,
        name,
        province,
        imageUrl,
        stars,
      },
    });
    res.status(201).json(carwash);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to fetch CarwashServices
app.get('/carwashservices', async (req, res) => {
  try {
    const carwashServices = await prisma.carwashService.findMany({
      include: {
        carWashTypes: true,
        schedules: true,
        bookings:true
      }
    });
    res.json(carwashServices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to create a new CarwashService
app.post('/carwashservices', async (req, res) => {
  let emuCodeKey;
  
  try {
    const { location, description, address, capacity, latitude, longitude, phoneNumber, name, district, emuCode, province, imageUrl, status, pincode, stars, carWashTypes, schedules } = req.body;
    if(province === 'Улаанбаатар') {
      emuCodeKey = district;
    } else {
      emuCodeKey = province;
    }
    const carwashService = await prisma.carwashService.create({
      data: {
        location,
        description,
        address,
        capacity,
        latitude,
        longitude,
        phoneNumber,
        name,
        district,
        emuCode: generateRandomEmuCode(emuCodeKey),
        province,
        imageUrl,
        status,
        pincode,
        stars,
        carWashTypes: {
          create: carWashTypes,
        },
        schedules: {
          create: schedules.map(schedule => ({
            startTime: new Date(`1970-01-01T${schedule.startTime}:00Z`).toISOString(),  // Construct full ISO string
            endTime: new Date(`1970-01-01T${schedule.endTime}:00Z`).toISOString(),      // Construct full ISO string
            date: new Date(schedule.date).toISOString(),
            holidays: schedule.holidays.map(holiday => new Date(holiday).toISOString()),
          })),
        },
      },
    });
    res.status(201).json(carwashService);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message });
  }
});

// GET endpoint to fetch bookings
app.get('/bookings', async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        carWashType: true,
        timetable: true,
        user: true,
        carwashService: true ,
      },
    });
    res.json(bookings);
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

// GET endpoint to fetch a single booking by ID
app.get('/bookings/status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        carWashType: true,
        timetable: true,
        user: true,
        carwashService: true,
      },
    });
    const status = booking.status;

    if (!booking) {
      return res.status(404).json({ error: 'Booking status not found' });
    }

    res.json(status);
  } catch (error) {
    console.error('Failed to fetch booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking.' });
  }
});

// POST endpoint to create a new booking
app.post('/bookings', async (req, res) => {
  try {
    const {
      scheduledTime,
      carSize,
      washType,
      date,
      endTime,
      price,
      userId,
      timetable,
      CarWashService,
      carNumber,
    } = req.body;

    if (
      !scheduledTime ||
      !washType ||
      !carSize ||
      !date ||
      !endTime ||
      !price ||
      !timetable ||
      !userId ||
      !CarWashService
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Function to add hours to a given date string
    const addHours = (dateString, hours) => {
      const date = new Date(dateString);
      date.setHours(date.getHours() + hours);
      return date.toISOString();
    };
    
    // Adding 8 hours to the provided date strings
    const updatedScheduledTime = addHours(scheduledTime, 8);
    const updatedDate = addHours(date, 8);
    const updatedEndTime = addHours(endTime, 8);

    const booking = await prisma.booking.create({
      data: {
        scheduledTime: updatedScheduledTime,
        washType,
        carSize,
        date: updatedDate,
        endTime: updatedEndTime,
        price,
        carNumber,
        user: {
          connect: { id: userId } // Correctly connect the user
        },
        timetable: {
          connect: { id: timetable } // Correctly connect the timetable
        },
        carwashService: {
          connect: { id: CarWashService } // Correctly connect the car wash service
        }
      },
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error('Failed to create booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});


// Add this route to your Express server

app.get('/user-orders/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const orders = await prisma.booking.findMany({
      where: {
        userId: parseInt(userId, 10),
      },
      include: {
        carWashType: true,
        timetable: true,
        carwashService: true,
      },
    });
    res.json(orders);
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});




