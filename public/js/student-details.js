// التحقق من وجود token وid
if (!localStorage.getItem('studentToken') || !localStorage.getItem('studentId')) {
    window.location.href = '/students-portal.html';
}

async function loadStudentDetails() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const studentId = urlParams.get('id');
        
        if (!studentId) {
            console.error('No student ID provided');
            return;
        }

        // Fetch student details
        console.log('Fetching student details for ID:', studentId);
        const studentResponse = await fetch(`/api/students/${studentId}`);
        
        if (!studentResponse.ok) {
            throw new Error('Failed to fetch student details');
        }

        const student = await studentResponse.json();
        console.log('Received student data:', student);

        // Fetch wird routine
        const wirdResponse = await fetch('/api/wird-routine');
        if (!wirdResponse.ok) {
            throw new Error('Failed to fetch wird routine');
        }
        const wirdData = await wirdResponse.json();
        console.log('Received wird routine:', wirdData);

        // Update wird routine
        document.getElementById('wird-routine').textContent = wirdData.wirdRoutine || 'لم يتم تحديد الورد اليومي';

        // Update basic information
        document.getElementById('student-name').textContent = student.name;
        document.getElementById('current-surah').textContent = student.currentSurah || 'لم يتم تحديد السورة';
        document.getElementById('last-surah').textContent = student.lastSurah || 'لم يتم تحديد السورة';
        document.getElementById('evaluation').textContent = student.evaluation || 'لم يتم التقييم';
        
        // Update payment information
        document.getElementById('payment-type').textContent = student.paymentType || 'لم يتم تحديد نوع الدفع';
        document.getElementById('payment-status').textContent = student.currentMonthPaid ? 'تم الدفع' : 'لم يتم الدفع';
        document.getElementById('last-payment-date').textContent = student.lastPaymentDate ? new Date(student.lastPaymentDate).toLocaleDateString('ar-SA') : 'لا يوجد';
        document.getElementById('sessions-attended').textContent = (student.sessionsAttended || 0) + ' حلقه';

        // Update student photo
        const studentPhoto = document.getElementById('student-image');
        if (student.photo) {
            studentPhoto.src = student.photo;
        } else {
            studentPhoto.src = '/images/default-avatar.png';
        }

        // Update schedule table
        const scheduleTableBody = document.getElementById('schedule-table-body');
        console.log('Schedule table body element:', scheduleTableBody);
        console.log('Student schedule data:', student.schedule);

        if (scheduleTableBody) {
            scheduleTableBody.innerHTML = ''; // Clear existing rows

            if (student.schedule && student.schedule.length > 0) {
                console.log('Adding schedule rows...');
                student.schedule.forEach(scheduleItem => {
                    console.log('Adding schedule item:', scheduleItem);
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                            ${scheduleItem.day}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                            ${scheduleItem.time}
                        </td>
                    `;
                    scheduleTableBody.appendChild(row);
                });
            } else {
                console.log('No schedule data, adding empty message');
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td colspan="2" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                        لا توجد مواعيد محددة
                    </td>
                `;
                scheduleTableBody.appendChild(row);
            }
        } else {
            console.error('Schedule table body element not found!');
        }

        // Hide loading spinner and show content
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';

    } catch (error) {
        console.error('Error loading student details:', error);
        alert('حدث خطأ أثناء تحميل بيانات الطالب');
        document.getElementById('loading').style.display = 'none';
    }
}

// Load student details when the page loads
document.addEventListener('DOMContentLoaded', loadStudentDetails);

// تسجيل الخروج
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('studentToken');
    localStorage.removeItem('studentId');
    window.location.href = '/students-portal.html';
});
