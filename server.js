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

// Check if running in production (Vercel)
const isProduction = process.env.VERCEL === '1';

// Create necessary directories (only in development)
if (!isProduction) {
    const publicDir = path.join(__dirname, 'public');
    const uploadsDir = path.join(publicDir, 'uploads');
    const dataDir = path.join(__dirname, 'data');
    const logsDir = path.join(__dirname, 'logs');

    [publicDir, uploadsDir, dataDir, logsDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

// Configure multer for file uploads with error handling
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (isProduction) {
            // In production, use /tmp directory
            cb(null, '/tmp');
        } else {
            // In development, use uploads directory
            const uploadsDir = path.join(__dirname, 'public', 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            cb(null, uploadsDir);
        }
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept images only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
}).single('photo');

// Middleware to handle file upload
const handleUpload = (req, res, next) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({ error: 'خطأ في رفع الملف' });
        } else if (err) {
            console.error('Upload error:', err);
            return res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف' });
        }
        next();
    });
};

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Serve students.json from data directory
app.get('./data/students.json', (req, res) => {
    try {
        const data = readStudentsData();
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
        let rawData;
        if (isProduction) {
            // In production, read from environment variable
            rawData = process.env.STUDENTS_DATA || '{"students":[],"wirdRoutine":""}';
        } else {
            // In development, read from file
            const dataPath = path.join(__dirname, 'data', 'students.json');
            if (!fs.existsSync(dataPath)) {
                return { students: [], wirdRoutine: '' };
            }
            rawData = fs.readFileSync(dataPath, 'utf8');
        }
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Error reading students data:', error);
        return { students: [], wirdRoutine: '' };
    }
}

function writeStudentsData(data) {
    try {
        if (isProduction) {
            // In production, log the data (you'll need to handle this differently)
            console.log('Would update data in production:', data);
            return true;
        } else {
            // In development, write to file
            const dataPath = path.join(__dirname, 'data', 'students.json');
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
            return true;
        }
    } catch (error) {
        console.error('Error writing students data:', error);
        return false;
    }
}

// Helper function to format dates in 12-hour format
function formatDate(date) {
    if (!date) return null;
    const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    };
    return new Date(date).toLocaleString('ar-SA', options);
}

// API Routes
app.get('/api/students', (req, res) => {
    try {
        const data = readStudentsData();
        
        // Format dates for all students
        const formattedStudents = data.students.map(student => ({
            ...student,
            lastPaymentDate: formatDate(student.lastPaymentDate),
            createdAt: formatDate(student.createdAt)
        }));

        res.json(formattedStudents);
    } catch (error) {
        console.error('Error getting students:', error);
        res.status(500).json({ error: 'Failed to get students' });
    }
});

app.get('/api/students/:id', (req, res) => {
    try {
        const studentsData = readStudentsData();
        const student = studentsData.students.find(s => s.id === req.params.id);
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Format dates before sending
        if (student.lastPaymentDate) {
            student.lastPaymentDate = formatDate(student.lastPaymentDate);
        }
        if (student.createdAt) {
            student.createdAt = formatDate(student.createdAt);
        }

        res.json(student);
    } catch (error) {
        console.error('Error getting student:', error);
        res.status(500).json({ error: 'Failed to get student' });
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

app.post('/api/students', handleUpload, (req, res) => {
    try {
        const data = readStudentsData();
        const studentId = Date.now().toString();
        
        // Parse schedule if it's a string
        let schedule = req.body.schedule;
        try {
            if (typeof schedule === 'string') {
                schedule = JSON.parse(schedule);
            }
        } catch (error) {
            console.error('Error parsing schedule:', error);
            schedule = [];
        }

        const newStudent = {
            id: studentId,
            name: req.body.name,
            password: req.body.password,
            currentSurah: req.body.currentSurah,
            lastSurah: req.body.lastSurah || '',
            schedule: schedule,
            evaluation: req.body.evaluation || 'ممتاز',
            sessionsAttended: 0,
            paymentType: req.body.paymentType || 'بالحلقه',
            notes: req.body.notes || '',
            photo: req.file ? `/uploads/${req.file.filename}` : null,
            currentMonthPaid: false,
            lastPaymentDate: null,
            createdAt: new Date().toISOString()
        };

        if (!data.students) {
            data.students = [];
        }

        // Validate required fields
        const requiredFields = ['name', 'password', 'currentSurah'];
        for (const field of requiredFields) {
            if (!newStudent[field]) {
                throw new Error(`الحقل "${field}" مطلوب`);
            }
        }

        data.students.push(newStudent);
        
        try {
            const success = writeStudentsData(data);
            if (!success) {
                throw new Error('فشل في حفظ بيانات الطالب - تأكد من صلاحيات الملف');
            }

            console.log('Student data written successfully');
            res.status(201).json({ 
                message: 'تم إضافة الطالب بنجاح', 
                student: newStudent 
            });
        } catch (error) {
            console.error('Error writing student data:', error);
            res.status(500).json({ message: 'حدث خطأ في حفظ بيانات الطالب: ' + error.message });
        }
    } catch (error) {
        console.error('Error adding student:', error);
        res.status(500).json({ message: 'حدث خطأ في إضافة الطالب: ' + error.message });
    }
});

app.put('/api/students/:id', handleUpload, (req, res) => {
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

        // Keep existing student data
        let updatedStudent = { ...data.students[studentIndex] };

        // Update fields if they are provided in the request
        if (req.body.name !== undefined) updatedStudent.name = req.body.name;
        if (req.body.currentSurah !== undefined) updatedStudent.currentSurah = req.body.currentSurah;
        if (req.body.lastSurah !== undefined) updatedStudent.lastSurah = req.body.lastSurah;
        if (req.body.evaluation !== undefined) updatedStudent.evaluation = req.body.evaluation;
        if (req.body.paymentType !== undefined) updatedStudent.paymentType = req.body.paymentType;
        if (req.body.notes !== undefined) updatedStudent.notes = req.body.notes;
        if (req.body.sessionsAttended !== undefined) updatedStudent.sessionsAttended = parseInt(req.body.sessionsAttended) || 0;
        if (req.body.currentMonthPaid !== undefined) {
            updatedStudent.currentMonthPaid = req.body.currentMonthPaid;
            updatedStudent.lastPaymentDate = req.body.currentMonthPaid ? new Date().toISOString() : null;
        }

        // Handle password update
        if (req.body.password && req.body.password.trim() !== '') {
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

        // Handle schedule update
        if (req.body.schedule) {
            try {
                updatedStudent.schedule = typeof req.body.schedule === 'string' 
                    ? JSON.parse(req.body.schedule) 
                    : req.body.schedule;
            } catch (error) {
                console.error('Error parsing schedule:', error);
            }
        }

        // Update the student data
        data.students[studentIndex] = updatedStudent;
        
        // Write to file
        const success = writeStudentsData(data);
        if (!success) {
            throw new Error('Failed to write student data');
        }
        
        console.log('Student updated successfully:', updatedStudent);
        
        // Format dates before sending response
        const responseStudent = {
            ...updatedStudent,
            lastPaymentDate: updatedStudent.lastPaymentDate ? formatDate(updatedStudent.lastPaymentDate) : null,
            createdAt: updatedStudent.createdAt ? formatDate(updatedStudent.createdAt) : null
        };
        
        res.json(responseStudent);
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
        console.log('Students data:', studentsData);
        
        // Find student with matching credentials
        const student = studentsData.students.find(s => {
            const nameMatch = s.name.trim().toLowerCase() === studentName.trim().toLowerCase();
            const passwordMatch = s.password === password;
            console.log('Checking student:', { 
                name: s.name, 
                nameMatch, 
                passwordMatch 
            });
            return nameMatch && passwordMatch;
        });

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
            process.env.JWT_SECRET || 'your-secret-key',
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
        const data = readStudentsData();
        res.json({ wirdRoutine: data.wirdRoutine || '' });
    } catch (error) {
        console.error('Error getting wird routine:', error);
        res.status(500).json({ error: 'Failed to get wird routine' });
    }
});

// Update wird routine
app.post('/api/wird-routine', (req, res) => {
    try {
        const { wirdRoutine } = req.body;
        console.log('Updating wird routine to:', wirdRoutine);

        const data = readStudentsData();
        data.wirdRoutine = wirdRoutine;
        
        const success = writeStudentsData(data);
        if (!success) {
            throw new Error('Failed to write wird routine');
        }

        res.json({ wirdRoutine: data.wirdRoutine });
    } catch (error) {
        console.error('Error updating wird routine:', error);
        res.status(500).json({ error: 'Failed to update wird routine' });
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
function startServer(port) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is already in use. Trying port ${port + 1}`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });
}

startServer(port);
