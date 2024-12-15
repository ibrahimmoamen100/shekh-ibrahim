const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken'); 
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Create necessary directories
const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const dataDir = path.join(__dirname, 'data');
const logsDir = path.join(__dirname, 'logs');

[publicDir, uploadsDir, dataDir, logsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve students.json from data directory
app.get('/data/students.json', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'data', 'students.json');
        console.log('Serving students.json from:', filePath);
        
        // Read the file synchronously to ensure we get the latest data
        const data = fs.readFileSync(filePath, 'utf8');
        console.log('Read data:', data);
        
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    } catch (error) {
        console.error('Error serving students.json:', error);
        res.status(500).json({ error: 'Failed to read students.json' });
    }
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Handle 404 errors for static files
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', req.path));
    } else {
        next();
    }
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Helper Functions
function readStudentsData() {
    try {
        const filePath = path.join(dataDir, 'students.json');
        
        // If file doesn't exist, create it with default structure
        if (!fs.existsSync(filePath)) {
            const defaultData = { students: [], wirdRoutine: '' };
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        
        const rawData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading students data:', error);
        return { students: [], wirdRoutine: '' };
    }
}

function writeStudentsData(data) {
    try {
        const filePath = path.join(dataDir, 'students.json');
        
        // Ensure data has the correct structure
        if (!data.students) {
            data = { students: [], wirdRoutine: '', ...data };
        }
        if (!data.wirdRoutine) {
            data.wirdRoutine = '';
        }
        
        // Format JSON with indentation for readability
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing students data:', error);
        return false;
    }
}

// API Routes
app.get('/api/students', (req, res) => {
    try {
        const data = readStudentsData();
        res.json(data.students);
    } catch (error) {
        console.error('Error getting students:', error);
        res.status(500).json({ error: 'Failed to get students' });
    }
});

app.get('/api/students/:id', (req, res) => {
    try {
        const studentId = req.params.id;
        console.log('Fetching details for student:', studentId);

        const data = readStudentsData();
        const student = data.students.find(s => s.id === studentId);

        if (!student) {
            console.log('Student not found:', studentId);
            return res.status(404).json({ error: 'الطالب غير موجود' });
        }

        console.log('Found student:', student);
        // Send all student data except password
        const { password, ...studentData } = student;
        console.log('Sending student data:', studentData);
        res.json(studentData);
    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب بيانات الطالب' });
    }
});

app.post('/api/students', upload.single('photo'), (req, res) => {
    try {
        console.log('Received request to add student');
        console.log('Request body:', req.body);
        console.log('File:', req.file);

        // التحقق من البيانات المطلوبة
        if (!req.body.name) {
            return res.status(400).json({ message: 'الرجاء إدخال اسم الطالب' });
        }
        if (!req.body.password) {
            return res.status(400).json({ message: 'الرجاء إدخال الرقم السري للطالب' });
        }
        if (!req.body.currentSurah) {
            return res.status(400).json({ message: 'الرجاء إدخال السورة الحالية' });
        }
        
        const data = readStudentsData();
        console.log('Current students data:', data);
        
        // إنشاء معرف فريد للطالب
        const studentId = Date.now().toString();
        
        // معالجة جدول المواعيد
        let schedule = [];
        if (req.body.schedule) {
            try {
                schedule = JSON.parse(req.body.schedule);
                console.log('Parsed schedule:', schedule);
            } catch (error) {
                console.error('Error parsing schedule:', error);
                return res.status(400).json({ message: 'خطأ في تنسيق جدول المواعيد' });
            }
        }
        
        const newStudent = {
            id: studentId,
            name: req.body.name,
            password: req.body.password,
            currentSurah: req.body.currentSurah,
            schedule: schedule,
            evaluation: "جديد",
            sessionsAttended: 0,
            paymentType: req.body.paymentType || 'perSession',
            notes: req.body.notes || '',
            photo: req.file ? `/uploads/${req.file.filename}` : null,
            currentMonthPaid: false,
            lastPaymentDate: null,
            createdAt: new Date().toISOString(),
            lastSurah: req.body.lastSurah || ''
        };

        console.log('New student data to be added:', newStudent);

        // Ensure data has the correct structure
        if (!data.students) {
            data.students = [];
        }
        if (!data.wirdRoutine) {
            data.wirdRoutine = '';
        }

        data.students.push(newStudent);
        console.log('Updated students data before writing:', data);
        
        const success = writeStudentsData(data);
        if (!success) {
            throw new Error('Failed to write student data');
        }

        console.log('Data written successfully');
        res.status(201).json({ 
            message: 'تم إضافة الطالب بنجاح', 
            student: newStudent 
        });
    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).json({ message: 'حدث خطأ في إضافة الطالب: ' + error.message });
    }
});

app.post('/api/students/new', upload.single('photo'), (req, res) => {
    try {
        const studentsData = readStudentsData();
        
        // إنشاء معرف فريد للطالب
        const studentId = Date.now().toString();
        
        const newStudent = {
            id: studentId,
            name: req.body.name,
            password: req.body.password, // في الإنتاج يجب تشفير كلمة المرور
            currentSurah: req.body.currentSurah,
            lastSurah: req.body.lastSurah,
            schedule: [{
                day: req.body.day,
                time: req.body.time
            }],
            evaluation: "جديد",
            sessionsAttended: 0,
            paymentType: req.body.paymentType,
            notes: req.body.notes,
            photo: req.file ? `/uploads/${req.file.filename}` : null,
            currentMonthPaid: false,
            lastPaymentDate: null,
            createdAt: new Date().toISOString(),
            progress: 0,
            lessons: [],
            payments: []
        };

        studentsData.students.push(newStudent);
        writeStudentsData(studentsData);

        res.status(201).json({ message: 'تم إضافة الطالب بنجاح', student: newStudent });
    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).json({ message: 'حدث خطأ في إضافة الطالب' });
    }
});

app.put('/api/students/:id', upload.single('photo'), (req, res) => {
    try {
        console.log('Received update request for student:', req.params.id);
        console.log('Request body:', req.body);

        const data = readStudentsData();
        const studentId = req.params.id;
        const studentIndex = data.students.findIndex(s => s.id === studentId);
        
        if (studentIndex === -1) {
            console.log('Student not found:', studentId);
            return res.status(404).json({ error: 'Student not found' });
        }

        let updatedStudent = { ...data.students[studentIndex] };

        // Handle payment status update
        if (req.body.currentMonthPaid !== undefined || req.body.sessionsAttended !== undefined) {
            if (req.body.currentMonthPaid !== undefined) {
                updatedStudent.currentMonthPaid = req.body.currentMonthPaid;
                updatedStudent.lastPaymentDate = req.body.currentMonthPaid ? new Date().toISOString() : null;
            }
            if (req.body.sessionsAttended !== undefined) {
                updatedStudent.sessionsAttended = req.body.sessionsAttended;
            }
        } 
        // Handle full student update
        else {
            // Update basic info
            updatedStudent = {
                ...updatedStudent,
                name: req.body.name || updatedStudent.name,
                currentSurah: req.body.currentSurah || updatedStudent.currentSurah,
                lastSurah: req.body.lastSurah || updatedStudent.lastSurah,
                evaluation: req.body.evaluation || updatedStudent.evaluation,
                paymentType: req.body.paymentType || updatedStudent.paymentType,
                notes: req.body.notes || updatedStudent.notes
            };

            // Handle password update
            if (req.body.password && req.body.password.trim() !== '') {
                console.log('Updating password for student:', studentId);
                updatedStudent.password = req.body.password.trim();
            }

            // Handle payment type change
            if (req.body.paymentType && req.body.paymentType !== data.students[studentIndex].paymentType) {
                updatedStudent.currentMonthPaid = false;
                updatedStudent.lastPaymentDate = null;
                updatedStudent.sessionsAttended = 0;
            }

            // Handle photo update
            if (req.file) {
                if (data.students[studentIndex].photo) {
                    const oldPhotoPath = path.join(__dirname, 'public', data.students[studentIndex].photo);
                    if (fs.existsSync(oldPhotoPath)) {
                        fs.unlinkSync(oldPhotoPath);
                    }
                }
                updatedStudent.photo = '/uploads/' + req.file.filename;
            }
        }

        // Update the student data
        data.students[studentIndex] = updatedStudent;
        
        // Write to both files
        writeStudentsData(data);
        
        console.log('Student updated successfully:', updatedStudent);
        res.json(updatedStudent);
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({ error: 'Failed to update student', message: error.message });
    }
});

app.delete('/api/students/:id', (req, res) => {
    try {
        const data = readStudentsData();
        const studentId = req.params.id;
        
        const initialLength = data.students.length;
        data.students = data.students.filter(student => student.id !== studentId);
        
        if (data.students.length === initialLength) {
            return res.status(404).json({ message: 'الطالب غير موجود' });
        }
        
        writeStudentsData(data);
        res.json({ message: 'تم حذف الطالب بنجاح' });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ message: 'حدث خطأ في حذف الطالب' });
    }
});

// Student login endpoint
app.post('/api/student/login', async (req, res) => {
    try {
        const { studentName, password } = req.body;
        console.log('Login attempt for:', { studentName });

        // Read students data
        const studentsData = readStudentsData();
        
        // Find student with matching credentials
        const student = studentsData.students.find(s => 
            s.name.trim().toLowerCase() === studentName.trim().toLowerCase() && 
            s.password === password
        );

        if (!student) {
            console.log('Login failed: Invalid credentials');
            return res.status(401).json({ 
                success: false, 
                error: 'اسم الطالب أو الرقم السري غير صحيح' 
            });
        }

        // Create JWT token
        const token = jwt.sign(
            { studentId: student.id, studentName: student.name },
            'your-secret-key',
            { expiresIn: '24h' }
        );

        console.log('Login successful for student:', student.name);
        res.json({
            success: true,
            token,
            studentId: student.id
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'حدث خطأ في تسجيل الدخول' 
        });
    }
});

app.get('/api/students/:id', async (req, res) => {
    try {
        const studentId = req.params.id;
        
        if (!studentId) {
            return res.status(400).json({ error: 'معرف الطالب مطلوب' });
        }
        
        const studentsData = readStudentsData();
        const student = studentsData.students.find(s => s.id === studentId);

        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'الطالب غير موجود'
            });
        }

        // Send all student data except password
        const { password, ...studentData } = student;
        res.json(studentData);
    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في جلب بيانات الطالب'
        });
    }
});

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
    try {
        const { password } = req.body;
        
        // Check if password is correct
        if (password === '45086932') {
            // Generate a simple token
            const token = 'admin_' + Date.now();
            res.json({ token });
        } else {
            res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'حدث خطأ في تسجيل الدخول' });
    }
});

// إضافة نقطة نهاية للطلاب المتميزين
app.get('/api/outstanding-students', (req, res) => {
    try {
        const studentsData = readStudentsData();
        const outstandingStudents = studentsData.students
            .filter(student => student.evaluation === 'ممتاز')
            .map(student => ({
                id: student.id,
                name: student.name,
                currentSurah: student.currentSurah,
                photo: student.photo
            }));

        res.json(outstandingStudents);
    } catch (error) {
        console.error('Error fetching outstanding students:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب بيانات الطلاب المتميزين' });
    }
});

// Get wird routine
app.get('/api/wird-routine', (req, res) => {
    try {
        const studentsData = readStudentsData();
        console.log('Wird Routine:', studentsData.wirdRoutine); // Add logging
        res.json({ wirdRoutine: studentsData.wirdRoutine });
    } catch (error) {
        console.error('Error getting wird routine:', error);
        res.status(500).json({ error: 'Failed to get wird routine' });
    }
});

// Update wird routine endpoint
app.post('/api/wird-routine', (req, res) => {
    console.log('Received wird routine update request');
    console.log('Request body:', req.body);
    
    try {
        const { wirdRoutine } = req.body;
        
        if (!wirdRoutine) {
            console.log('No wirdRoutine provided in request');
            return res.status(400).json({ error: 'الورد اليومي مطلوب' });
        }

        // Read current data
        let data = readStudentsData();
        
        // If data is empty or doesn't have the correct structure, initialize it
        if (!data || typeof data !== 'object') {
            data = { students: [], wirdRoutine: '' };
        }
        
        // Update wirdRoutine at the root level
        data.wirdRoutine = wirdRoutine;
        console.log('Updating wirdRoutine to:', wirdRoutine);
        
        // Write the updated data back to the file
        writeStudentsData(data);
        console.log('Successfully updated students.json with new wirdRoutine');
        
        // Send success response
        return res.status(200).json({ message: 'تم تحديث الورد اليومي بنجاح' });
    } catch (error) {
        console.error('Error in wird routine update:', error);
        return res.status(500).json({ error: 'حدث خطأ في تحديث الورد اليومي: ' + error.message });
    }
});

// Authentication middleware
function authenticateAdmin(req, res, next) {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin token (you should use your actual admin token verification logic here)
        if (token === localStorage.getItem('adminToken')) {
            next();
        } else {
            return res.status(401).json({ error: 'Invalid token' });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Authentication failed' });
    }
}

// Start the server
const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is already in use. Trying port ${port + 1}`);
        app.listen(port + 1, () => {
            console.log(`Server is running on port ${port + 1}`);
        });
    } else {
        console.error('Server error:', err);
    }
});
