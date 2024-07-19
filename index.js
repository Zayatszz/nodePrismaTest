const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
const app = express();

app.use(express.json());

// Example route to fetch users
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
      }
    });
    res.json(carwashServices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to create a new CarwashService
app.post('/carwashservices', async (req, res) => {
  try {
    const { location, description, address, capacity, latitude, longitude, phoneNumber, name, district, province, imageUrl, status, pincode, stars, carWashTypes, schedules } = req.body;
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
