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
app.post('/qpay/token', async (req, res) => {
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

    console.log("QPay token fetched successfully");
    console.log(response.data);
    res.status(200).json({ access_token: response.data.access_token });
  } catch (error) {
    console.error('Error fetching QPay token:', error.response ? error.response.data : error.message);
    res.status(error.response ? error.response.status : 500).json({
      error: error.response ? error.response.data : 'Internal Server Error',
    });
  }
});

// Create QPay invoice API
app.post('/qpay/invoice', async (req, res) => {
  const { token, bookingId, amount, description, service, userId } = req.body;
  const invoice_code = process.env.INVOICE_CODE;
  const callback_url = `http://www.emu.mn/api/qpay/callback/${bookingId}`;
  const sender_invoice_no = bookingId.toString();

  try {
    // Fetch user details from the database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phoneNumber: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Construct the invoice receiver data
    const invoice_receiver_data = {
      name: user.name,
      email: user.email,
      phone: user.phoneNumber,
    };

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

    const invoiceId = response.data.invoice_id;

    const newInvoice = await prisma.qPayInvoice.create({
      data: {
        invoiceId,
        bookingId,
        status: 'pending',
        amount,
        callbackUrl: callback_url,
      },
    });

    const paymentDetail = newInvoice.id.toString();

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
      carWashTypeId,
      washType,
      carSize,
      date,
      endTime,
      paymentDetail,
      price,
      status,
      timetableId,
      userId,
      carWashServiceId,
      carNumber,
    } = req.body;

    if (
      !scheduledTime ||
      !carWashTypeId ||
      !washType ||
      !carSize ||
      !date ||
      !endTime ||
      !price ||
      !timetableId ||
      !userId ||
      !carWashServiceId
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const booking = await prisma.booking.create({
      data: {
        scheduledTime: new Date(scheduledTime),
        carWashTypeId,
        washType,
        carSize,
        date: new Date(date),
        endTime: new Date(endTime),
        paymentDetail,
        price,
        status,
        timetableId,
        userId,
        carWashServiceId,
        carNumber,
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




