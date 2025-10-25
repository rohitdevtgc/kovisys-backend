const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

dotenv.config();

// Connect to database
connectDB();

const app = express();

// CORS - Allow both local and production frontend
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://kovisys-frontend.vercel.app'] // We'll update this later
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Instagram Analytics API is running!' });
});

// Routes
const authRoutes = require('./routes/auth');
const instagramRoutes = require('./routes/instagram');

app.use('/auth', authRoutes);
app.use('/instagram', instagramRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});