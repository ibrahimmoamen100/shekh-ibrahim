// دالة لجلب وعرض الطلاب المتميزين
async function loadOutstandingStudents() {
    try {
        const response = await fetch('/api/outstanding-students');
        const students = await response.json();
        
        const container = document.getElementById('outstanding-students');
        container.innerHTML = students.map(student => `
            <div class="bg-white rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition duration-300">
                <div class="relative pb-48">
                    <img src="${student.photo || '/images/default-avatar.png'}" 
                         alt="${student.name}" 
                         class="absolute h-full w-full object-cover">
                </div>
                <div class="p-4 text-center">
                    <h3 class="text-xl font-semibold mb-2">${student.name}</h3>
                    <p class="text-gray-600">
                        <i class="fas fa-book-quran ml-2"></i>
                        وصل إلى سورة ${student.currentSurah}
                    </p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading outstanding students:', error);
    }
}

// تحميل الطلاب المتميزين عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', loadOutstandingStudents);
