function startBackgroundSlider() {
    const layer1 = document.getElementById('bg-layer-1');
    const layer2 = document.getElementById('bg-layer-2');

    // ลิสต์ URL ภาพทั้งหมด (ต้องตรงกับที่คุณใช้)
    const imageUrls = [
        'background/Crit+Academy+_+Campaign+Ideas+DND+_+DND+Weapons.gif',
        'background/How+to+create+a+dnd+town+29.webp',
        'background/GIF1.gif',
        'background/Dont-Die.gif',
        'background/gif2.gif',
        'background/gif3.gif',
        'background/gif4.gif',
        'background/gif5.gif',
        'background/gif6.gif',
        'background/gif7.gif',
        'background/gif8.gif'
    ]; 

    let currentIndex = 0;
    let activeLayer = layer1;
    let inactiveLayer = layer2;
    
    const cycleDuration = 10000; // 10 วินาที (ระยะเวลารวมของแต่ละรอบ)
    const preFadeTime = 3000; // 3 วินาที (ผู้ใช้ต้องการให้เริ่มเฟดก่อนครบรอบ)

    // เวลาที่ต้องรอก่อน "เริ่ม" การเฟด
    // 10000ms - 3000ms = 7000ms
    const delayBeforeFade = cycleDuration - preFadeTime; 

    // 1. ตั้งค่าภาพเริ่มต้น
    activeLayer.style.backgroundImage = `url('${imageUrls[currentIndex]}')`;
    activeLayer.classList.add('active');

    // 2. ฟังก์ชันควบคุมการสลับรอบ
    function startNextCycle() {
        // 1. คำนวณดัชนีภาพถัดไป
        const nextIndex = (currentIndex + 1) % imageUrls.length;
        const nextImageUrl = imageUrls[nextIndex];

        // 2. โหลดภาพถัดไปลงใน Layer ที่ไม่ได้ใช้งาน (Inactive Layer) ทันที 
        //    (เพื่อให้เบราว์เซอร์มีเวลาโหลดภาพให้เสร็จก่อนเริ่มเฟดจริง)
        inactiveLayer.style.backgroundImage = `url('${nextImageUrl}')`;
        
        // 3. กำหนดเวลา "เริ่ม" การเฟด (7 วินาทีต่อมา)
        setTimeout(() => {
            // สลับ Layer เพื่อเริ่ม Cross-fade (ใช้ CSS transition 2 วินาที)
            [activeLayer, inactiveLayer] = [inactiveLayer, activeLayer];
            
            activeLayer.classList.add('active');
            inactiveLayer.classList.remove('active');
            
            // อัปเดตดัชนี
            currentIndex = nextIndex;
            
        }, delayBeforeFade); 
        
        // 4. กำหนดเวลาเริ่มรอบถัดไป (10 วินาทีต่อมา)
        setTimeout(startNextCycle, cycleDuration);
    }

    // เริ่มต้นลำดับการสลับภาพ
    startNextCycle();
}

document.addEventListener('DOMContentLoaded', startBackgroundSlider);