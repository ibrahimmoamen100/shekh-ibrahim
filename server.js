const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken'); 
const app = express();
const port = 3000;

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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
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
    const studentsFilePath = path.join(__dirname, 'data', 'students.json');
    try {
        if (!fs.existsSync(studentsFilePath)) {
            const defaultData = { students: [] };
            fs.writeFileSync(studentsFilePath, JSON.stringify(defaultData, null, 2), 'utf8');
            return defaultData;
        }
        const data = fs.readFileSync(studentsFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading students data:', error);
        const defaultData = { students: [] };
        fs.writeFileSync(studentsFilePath, JSON.stringify(defaultData, null, 2), 'utf8');
        return defaultData;
    }
}

function writeStudentsData(data) {
    const studentsFilePath = path.join(__dirname, 'data', 'students.json');
    try {
        // التأكد من وجود المجلد
        const dataDir = path.dirname(studentsFilePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        // التحقق من صحة البيانات
        if (!data || !data.students || !Array.isArray(data.students)) {
            throw new Error('Invalid data structure');
        }

        // كتابة البيانات بتنسيق مقروء
        const jsonString = JSON.stringify(data, null, 2);
        fs.writeFileSync(studentsFilePath, jsonString, { encoding: 'utf8', flag: 'w' });
        
        // التحقق من نجاح الكتابة
        const written = fs.readFileSync(studentsFilePath, 'utf8');
        const parsedWritten = JSON.parse(written);
        
        if (JSON.stringify(parsedWritten) !== JSON.stringify(data)) {
            throw new Error('Data verification failed');
        }
        
        console.log(`Data written successfully to ${studentsFilePath}`);
        return true;
    } catch (error) {
        console.error('Error writing students data:', error);
        throw error;
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
        console.log('Getting student details for ID:', req.params.id);
        const data = readStudentsData();
        console.log('Total students found:', data.students.length);
        
        const student = data.students.find(s => {
            console.log('Comparing:', s.id, req.params.id);
            return s.id === req.params.id;
        });
        
        console.log('Found student:', student);
        
        if (!student) {
            console.log('Student not found');
            return res.status(404).json({ error: 'الطالب غير موجود' });
        }
        
        // إخفاء كلمة المرور قبل إرسال البيانات
        const { password, ...studentData } = student;
        
        console.log('Sending student data:', studentData);
        res.json(studentData);
    } catch (error) {
        console.error('Error getting student:', error);
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
            createdAt: new Date().toISOString()
        };

        console.log('New student data to be added:', newStudent);

        if (!data.students) {
            data.students = [];
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
        const data = readStudentsData();
        const studentId = req.params.id;
        const studentIndex = data.students.findIndex(s => s.id === studentId);
        
        if (studentIndex === -1) {
            return res.status(404).json({ error: 'Student not found' });
        }

        let updatedStudent = { ...data.students[studentIndex] };

        // Handle JSON request for payment status update
        if (req.is('application/json')) {
            if (req.body.currentMonthPaid !== undefined) {
                updatedStudent.currentMonthPaid = req.body.currentMonthPaid;
                updatedStudent.lastPaymentDate = req.body.currentMonthPaid ? new Date().toISOString() : null;
            }
            if (req.body.sessionsAttended !== undefined) {
                updatedStudent.sessionsAttended = req.body.sessionsAttended;
            }
        } 
        // Handle form data request for full student update
        else {
            const schedule = [];
            if (req.body.day) {
                const days = Array.isArray(req.body.day) ? req.body.day : [req.body.day];
                const times = Array.isArray(req.body.time) ? req.body.time : [req.body.time];
                
                for (let i = 0; i < days.length; i++) {
                    schedule.push({
                        day: days[i],
                        time: times[i]
                    });
                }
            }

            updatedStudent = {
                ...updatedStudent,
                name: req.body.name || updatedStudent.name,
                currentSurah: req.body.currentSurah || updatedStudent.currentSurah,
                schedule: schedule.length > 0 ? schedule : updatedStudent.schedule,
                evaluation: req.body.evaluation || updatedStudent.evaluation,
                paymentType: req.body.paymentType || updatedStudent.paymentType,
                notes: req.body.notes || updatedStudent.notes
            };

            // Handle payment type change
            if (req.body.paymentType && req.body.paymentType !== data.students[studentIndex].paymentType) {
                updatedStudent.currentMonthPaid = false;
                updatedStudent.lastPaymentDate = null;
                updatedStudent.sessionsAttended = 0;
            }

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

        data.students[studentIndex] = updatedStudent;
        writeStudentsData(data);
        res.json(updatedStudent);
    } catch (error) {
        console.error('Error updating student:', error);
        res.status(500).json({ error: 'Failed to update student' });
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
        console.log('Fetching details for student ID:', studentId);

        // Read students data
        const studentsData = readStudentsData();
        
        // Find student
        const student = studentsData.students.find(s => s.id === studentId);
        console.log('Student found:', student ? 'Yes' : 'No');

        if (student) {
            // Remove sensitive data
            const { password, ...studentData } = student;
            res.json(studentData);
        } else {
            res.status(404).json({
                success: false,
                error: 'الطالب غير موجود'
            });
        }
    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).json({
            success: false,
            error: 'حدث خطأ في جلب بيانات الطالب'
        });
    }
});

// Middleware للتحقق من الـ token
function authenticateStudent(req, res, next) {
    try {
        console.log('Headers:', req.headers);
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('No auth header or invalid format');
            return res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً' });
        }
        
        const token = authHeader.split(' ')[1];
        console.log('Token:', token);
        
        if (!token) {
            console.log('No token found');
            return res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً' });
        }

        // في الإنتاج يجب التحقق من الـ JWT
        // هنا نقوم فقط بالتحقق من وجود الـ token
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'حدث خطأ في التحقق من الهوية' });
    }
}

app.get('/api/student/:id', authenticateStudent, (req, res) => {
    try {
        console.log('Getting student details for ID:', req.params.id);
        const studentId = req.params.id;
        
        if (!studentId) {
            console.log('No student ID provided');
            return res.status(400).json({ error: 'معرف الطالب مطلوب' });
        }
        
        // قراءة بيانات الطلاب من الملف
        const studentsData = readStudentsData();
        console.log('Found students:', studentsData.students.length);
        
        const student = studentsData.students.find(s => {
            console.log('Comparing IDs:', s.id, studentId);
            return s.id === studentId;
        });
        
        console.log('Found student:', student);

        if (!student) {
            console.log('Student not found');
            return res.status(404).json({ error: 'الطالب غير موجود' });
        }

        // إخفاء كلمة المرور قبل إرسال البيانات
        const { password, ...studentData } = student;
        
        console.log('Sending student data:', studentData);
        res.json({
            success: true,
            student: studentData
        });
    } catch (error) {
        console.error('Error fetching student details:', error);
        res.status(500).json({ error: 'حدث خطأ في جلب بيانات الطالب' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
