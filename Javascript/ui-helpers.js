// Javascript/ui-helpers.js - REBUILT VERSION (Final)

/**
 * แสดงหน้าต่าง Loading (เวอร์ชันมาตรฐาน)
 * @param {string} message - ข้อความที่จะแสดง
 */
function showLoading(message) {
  Swal.fire({
    title: message,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      Swal.showLoading(); 
    }
  });
}

/**
 * ซ่อนหน้าต่าง Loading
 */
function hideLoading() {
  Swal.close();
}

/**
 * [ ⭐️ ADDED FIX ⭐️ ]
 * ฟังก์ชันแสดง SweetAlert (ที่หายไป)
 */
function showCustomAlert(message, iconType = 'info') {
    const title = iconType === 'success' ? 'สำเร็จ!' : (iconType === 'error' ? 'ข้อผิดพลาด!' : 'แจ้งเตือน');
    Swal.fire({
        title: title,
        text: message,
        icon: iconType,
        confirmButtonText: 'ตกลง'
    });
}