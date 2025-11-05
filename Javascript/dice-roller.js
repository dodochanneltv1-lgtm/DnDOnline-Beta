/**
 * ฟังก์ชันแสดงอนิเมชันการทอยเต๋า
 * @param {number} diceCount - จำนวนลูกเต๋า
 * @param {number} diceType - ชนิดของเต๋า (d20 คือ 20)
 * @param {string} animationContainerId - ID ของ div ที่จะแสดงอนิเมชัน
 * @param {string} resultContainerId - ID ของ div ที่จะแสดงผลรวม
 * @param {HTMLElement} rollButton - Element ของปุ่มที่กดทอย
 * @returns {Promise<{results: number[], total: number}>} - คืนค่าผลลัพธ์และผลรวม
 */
function showDiceRollAnimation(diceCount, diceType, animationContainerId, resultContainerId, rollButton) {
    return new Promise(resolve => {
        const animationArea = document.getElementById(animationContainerId);
        const resultArea = document.getElementById(resultContainerId);

        // ปิดการใช้งานปุ่มชั่วคราว
        if (rollButton) rollButton.disabled = true;

        animationArea.innerHTML = '';
        resultArea.innerHTML = 'กำลังทอย...';

        const diceElements = [];
        for (let i = 0; i < diceCount; i++) {
            const die = document.createElement('div');
            die.className = 'dice rolling';
            die.textContent = '?';
            animationArea.appendChild(die);
            diceElements.push(die);
        }

        // อนิเมชันตัวเลขสุ่ม
        const animationInterval = setInterval(() => {
            diceElements.forEach(die => {
                die.textContent = Math.floor(Math.random() * diceType) + 1;
            });
        }, 80);

        // คำนวณผลลัพธ์จริง
        const finalResults = [];
        let total = 0;
        for (let i = 0; i < diceCount; i++) {
            const roll = Math.floor(Math.random() * diceType) + 1;
            finalResults.push(roll);
            total += roll;
        }

        // หน่วงเวลาเพื่อแสดงอนิเมชัน แล้วแสดงผลลัพธ์
        setTimeout(() => {
            clearInterval(animationInterval);

            diceElements.forEach((die, index) => {
                die.classList.remove('rolling');
                die.textContent = finalResults[index];
            });

            if (diceCount > 1) {
                resultArea.innerHTML = `ผลรวม: ${total}`;
            } else {
                resultArea.innerHTML = `ได้แต้ม: ${total}`;
            }

            // เปิดใช้งานปุ่มอีกครั้ง
            if (rollButton) rollButton.disabled = false;
            
            // ส่งค่ากลับไป
            resolve({ results: finalResults, total: total });

        }, 1500); // ระยะเวลาอนิเมชัน 1.5 วินาที
    });
}