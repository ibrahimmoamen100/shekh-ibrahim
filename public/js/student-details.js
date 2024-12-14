// التحقق من وجود token وid
if (!localStorage.getItem('studentToken') || !localStorage.getItem('studentId')) {
    window.location.href = '/students-portal.html';
}

async function fetchStudentDetails() {
    try {
        const studentId = localStorage.getItem('studentId');
        const token = localStorage.getItem('studentToken');
        
        console.log('Fetching details for student ID:', studentId);
        
        const response = await fetch(`/api/students/${studentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Failed to fetch student details');
        }

        const student = await response.json();
        console.log('Student data:', student);

        // تحديث واجهة المستخدم مع بيانات الطالب
        document.getElementById('student-name').textContent = student.name || 'غير محدد';
        document.getElementById('student-id').textContent = student.id || 'غير محدد';
        document.getElementById('current-surah').textContent = student.currentSurah || 'غير محدد';
        document.getElementById('evaluation').textContent = student.evaluation || 'غير محدد';
        document.getElementById('sessions-attended').textContent = student.sessionsAttended || 0;
        document.getElementById('payment-type').textContent = student.paymentType === 'perSession' ? 'بالحصة' : 'شهري';
        document.getElementById('current-month-paid').textContent = student.currentMonthPaid ? 'نعم' : 'لا';
        document.getElementById('last-payment-date').textContent = student.lastPaymentDate || 'غير محدد';
        document.getElementById('notes').textContent = student.notes || 'لا توجد ملاحظات';
        
        // تحديث صورة الطالب
        const studentImage = document.getElementById('student-image');
        if (student.photo) {
            studentImage.src = student.photo;
        } else {
            studentImage.src = '/images/default-avatar.png';
        }
        
        // عرض القسم الرئيسي بعد تحميل البيانات
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';

    } catch (error) {
        console.error('Error fetching student details:', error);
        alert('حدث خطأ في جلب بيانات الطالب');
        window.location.href = '/students-portal.html';
    }
}

// تسجيل الخروج
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('studentToken');
    localStorage.removeItem('studentId');
    window.location.href = '/students-portal.html';
});

// جلب بيانات الطالب عند تحميل الصفحة
fetchStudentDetails();
