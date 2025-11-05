/*
* =================================================================
* Javascript/map.js (v3 - FIXED)
* -----------------------------------------------------------------
* นี่คือ "สมอง" ของ map.html (ข้อ 10, 11)
* - จัดการ UI แผนที่
* - จัดการ UI และตรรกะของ กิลด์ (เลื่อนขั้น, อาชีพรอง)
* - จัดการ UI และตรรกะของ โรงเตี๊ยม (พักผ่อน)
* - จัดการ UI และตรรกะของ ร้านค้า (ซื้อของ, หักเงิน, ความทนทาน)
*
* [ ⭐️ KONGFA-FIX ⭐️ ]
* - แก้ไขบั๊กคำนวณสเตตัส (Stat Calculation Bug)
* - ลบฟังก์ชัน `calculateTotalStat_Map` ที่ล้าสมัยออก
* - เพิ่มฟังก์ชัน `calculateTotalStat` (Master Version) ที่ถูกต้อง
* (ตัดส่วน Aura ออก เพราะ map.js ไม่จำเป็นต้องใช้)
* - อัปเดต `loadInnUI` และ `restAtInn` ให้เรียกใช้ฟังก์ชันใหม่
*
* [ ⭐️ KONGFA-FIX (Bug 5) ⭐️ ]
* - แก้ไข `buyItem` ให้คัดลอก `item.effects` เมื่อซื้อยา
* - แก้ไข `buyItem` (isStackable) ให้เช็ค `effects` ด้วย
* =================================================================
*/

// --- Global State ---
const roomId = sessionStorage.getItem('roomId');
const currentUserUid = localStorage.getItem('currentUserUid'); // (Lobby.js v3 จะ set ค่านี้)
let playerRef = null;
let roomRef = null;
let playerData = null; // (เก็บข้อมูลผู้เล่นปัจจุบัน)
let guildQuests = {}; // (เก็บเควสเลื่อนขั้นทั้งหมด)
let shopData = {}; // (เก็บข้อมูลร้านค้าทั้งหมด)

// --- Helper Functions (ต้องถูกโหลดมาก่อนจาก charector.js) ---
const calcHPFn = typeof calculateHP === 'function' ? calculateHP : () => { console.error("calculateHP not found!"); return 10; };
const getStatBonusFn = typeof getStatBonus === 'function' ? getStatBonus : () => { console.error("getStatBonus not found!"); return 0; };


// =================================================================================
// [ ⭐️ KONGFA-FIX ⭐️ ]
// 0. Master Stat Calculation Function (v3.1)
// (นี่คือฟังก์ชันเวอร์ชันเต็มที่คัดลอกมาจาก player-dashboard-script.js)
// (ตัดส่วนที่ 5: Aura ออก เพราะ map.js ไม่ได้โหลด allPlayersInRoom)
// =================================================================================

function calculateTotalStat(charData, statKey) {
    if (!charData || !charData.stats) return 0;
    
    const stats = charData.stats;
    const upperStatKey = statKey.toUpperCase();
    
    // 1. คำนวณ Level (ถาวร + ชั่วคราว)
    const permanentLevel = charData.level || 1;
    let tempLevel = 0;
    if (Array.isArray(charData.activeEffects)) {
         charData.activeEffects.forEach(effect => {
             if ((effect.stat === 'Level' && effect.modType === 'FLAT') || effect.type === 'TEMP_LEVEL_PERCENT') {
                 if(effect.type === 'TEMP_LEVEL_PERCENT') {
                     tempLevel += Math.floor(permanentLevel * (effect.amount / 100));
                 } else {
                     tempLevel += (effect.amount || 0);
                 }
             }
         });
    }
    const totalLevel = permanentLevel + tempLevel;

    // 2. คำนวณ Base Stat (เผ่า + ที่อัป + บัฟ God Mode จาก DM)
    let baseStat = (stats.baseRaceStats?.[upperStatKey] || 0) +
                   (stats.investedStats?.[upperStatKey] || 0) +
                   (stats.tempStats?.[upperStatKey] || 0);

    // [ v3.1 ] เพิ่มโบนัสจากอาชีพหลักและอาชีพรอง
    const classMainData = (typeof CLASS_DATA !== 'undefined') ? CLASS_DATA[charData.classMain] : null;
    const classSubData = (typeof CLASS_DATA !== 'undefined') ? CLASS_DATA[charData.classSub] : null;
    
    if (classMainData && classMainData.bonuses) {
        baseStat += (classMainData.bonuses[upperStatKey] || 0);
    }
    if (classSubData && classSubData.bonuses) {
        baseStat += (classSubData.bonuses[upperStatKey] || 0);
    }

    // 3. [v3] คำนวณโบนัสจากสกิลติดตัว (Passive Skills)
    const raceId = charData.raceEvolved || charData.race;
    const racePassives = (typeof RACE_DATA !== 'undefined' && RACE_DATA[raceId]?.passives) ? RACE_DATA[raceId].passives : [];
    
    const classMainId = charData.classMain;
    const classPassives = (typeof CLASS_DATA !== 'undefined' && CLASS_DATA[classMainId]?.passives) ? CLASS_DATA[classMainId].passives : [];
    
    const classSubId = charData.classSub;
    const subClassPassives = (typeof CLASS_DATA !== 'undefined' && CLASS_DATA[classSubId]?.passives) ? CLASS_DATA[classSubId].passives : [];
    
    const skillPassives = [];
    if (typeof SKILL_DATA !== 'undefined') {
        // [ ⭐️ แก้ไข Bug 4 (เหมือน player-dashboard) ⭐️ ]
        if(SKILL_DATA[classMainId]) {
            skillPassives.push(...SKILL_DATA[classMainId].filter(s => s.skillTrigger === 'PASSIVE'));
        }
        if(SKILL_DATA[classSubId]) {
            skillPassives.push(...SKILL_DATA[classSubId].filter(s => s.skillTrigger === 'PASSIVE'));
        }
    }

    const allPassives = [...racePassives, ...classPassives, ...subClassPassives, ...skillPassives];
    
    allPassives.forEach(passiveOrSkill => {
        // [ ⭐️ แก้ไข Bug 4 (เหมือน player-dashboard) ⭐️ ]
        let effectObject = null;
        if (passiveOrSkill.skillTrigger === 'PASSIVE') {
            effectObject = passiveOrSkill.effect;
        } else if (passiveOrSkill.id && passiveOrSkill.effect) {
            effectObject = passiveOrSkill.effect;
        }

        if (effectObject) {
            const effects = Array.isArray(effectObject) ? effectObject : [effectObject];
            
            effects.forEach(p => {
                if (p && p.type === 'PASSIVE_STAT_PERCENT' && p.stats?.includes(upperStatKey)) {
                    baseStat *= (1 + (p.amount / 100));
                }
                if (p && p.type === 'PASSIVE_STAT_FLAT' && p.stats?.includes(upperStatKey)) {
                    baseStat += p.amount;
                }
            });
        }
    });

    // 4. คำนวณโบนัสจากบัฟ/ดีบัฟชั่วคราว (Active Effects)
    let flatBonus = 0;
    let percentBonus = 0;

    if (Array.isArray(charData.activeEffects)) {
        charData.activeEffects.forEach(effect => {
            if (effect.stat === upperStatKey || effect.stat === 'ALL') {
                if (effect.modType === 'FLAT') flatBonus += (effect.amount || 0);
                else if (effect.modType === 'PERCENT') percentBonus += (effect.amount || 0);
            }
        });
    }
    
    // 5. [v3] คำนวณโบนัสจากออร่า (ข้ามส่วนนี้ใน map.js)
    // (allPlayersInRoom is not available here)

    // 6. คำนวณโบนัสจากอุปกรณ์ (Equipped Items)
    let equipBonus = 0;
    if (charData.equippedItems) {
        for (const slot in charData.equippedItems) {
            const item = charData.equippedItems[slot];
            if (!item || !item.bonuses || item.bonuses[upperStatKey] === undefined) continue;

            let itemStatBonus = item.bonuses[upperStatKey] || 0;
            
            if (item.itemType === 'อาวุธ') {
                if (slot === 'mainHand') {
                    if (item.isProficient) itemStatBonus *= 1.015;
                } else if (slot === 'offHand') {
                    itemStatBonus *= 0.70;
                }
            }
            equipBonus += itemStatBonus;
        }
    }

    // 7. รวมค่าสถานะ
    let finalStat = (baseStat * (1 + (percentBonus / 100))) + flatBonus + equipBonus;

    // 8. คำนวณโบนัสจาก Level
    if (finalStat > 0 && totalLevel > 1) {
         const levelBonus = finalStat * (totalLevel - 1) * 0.2;
         finalStat += levelBonus;
    }
   
    // 9. [v3] ตรวจสอบเงื่อนไขพิเศษ
    if (charData.race === 'โกเลม' && upperStatKey === 'DEX') {
        return 0;
    }

    return Math.floor(finalStat);
}


// =================================================================================
// 1. UI Management (ข้อ 9)
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

/**
 * แสดง UI Modal หลัก (แผนที่, กิลด์, ร้านค้า)
 */
function showMapUI(panelId) {
    const container = document.getElementById('map-ui-container');
    if (!container) return;

    // ซ่อน Panel ที่เป็น UI หลักทั้งหมด
    container.querySelectorAll('.map-panel, .guild-panel, .inn-panel, .shop-panel').forEach(panel => {
        panel.classList.add('hidden');
    });

    let targetPanelId = '';
    switch (panelId) {
        case 'world':
            targetPanelId = 'world-map-panel';
            break;
        case 'city':
            targetPanelId = 'city-map-panel';
            break;
        case 'building':
        default:
            targetPanelId = 'building-map-panel';
            break;
    }

    const targetPanel = document.getElementById(targetPanelId);
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
    }
    
    container.classList.remove('hidden');
}

/**
 * ซ่อน UI Modal หลัก
 */
function hideMapUI() {
    const container = document.getElementById('map-ui-container');
    if (container) {
        container.classList.add('hidden');
    }
}

/**
 * แสดง UI ของอาคารที่เลือก (กิลด์, ร้านค้า, โรงเตี๊ยม) (ข้อ 10)
 */
function showBuildingUI(buildingId) {
    const container = document.getElementById('map-ui-container');
    if (!container) return;

    // ซ่อน Panel แผนที่ทั้งหมด
    container.querySelectorAll('.map-panel, .shop-panel, .guild-panel, .inn-panel').forEach(panel => {
        panel.classList.add('hidden');
    });

    let targetPanelId = '';
    switch (buildingId) {
        case 'guild':
            targetPanelId = 'guild-panel';
            loadGuildUI(); // (โหลดข้อมูลกิลด์)
            break;
        case 'shops':
            targetPanelId = 'shop-select-panel';
            // (ไม่ต้องโหลดอะไร แค่แสดงหน้าเลือก)
            break;
        case 'inn':
            targetPanelId = 'inn-panel';
            loadInnUI(); // (โหลดข้อมูลโรงเตี๊ยม)
            break;
        case 'shop_items':
             targetPanelId = 'shop-item-panel';
             // (openShop() จะเรียกอันนี้เอง)
             break;
        default:
            targetPanelId = 'building-map-panel';
            break;
    }

    const targetPanel = document.getElementById(targetPanelId);
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
    }
}

// =================================================================================
// 2. Guild Logic (ข้อ 10)
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

/**
 * โหลดข้อมูล UI กิลด์ (เควส + อาชีพรอง)
 */
function loadGuildUI() {
    if (!playerData) {
        console.error("Guild: Player data not loaded yet.");
        return;
    }

    const subClassSection = document.getElementById('guild-subclass-section');
    const subClassSelect = document.getElementById('subclass-select');

    // ตรวจสอบเงื่อนไขการเลือกอาชีพรอง (ข้อ 10)
    if (playerData.level >= 10 && !playerData.classSub) {
        subClassSelect.innerHTML = '<option value="">-- เลือกอาชีพรอง --</option>';
        
        // (ดึงอาชีพ T1 ทั้งหมด)
        const t1Classes = ["นักรบ", "นักเวท", "นักบวช", "โจร", "เรนเจอร์", "แทงค์", "พ่อค้า"];
        
        t1Classes.forEach(className => {
            // (ห้ามเลือกซ้ำกับอาชีพหลัก)
            if (playerData.classMain !== className) {
                subClassSelect.innerHTML += `<option value="${className}">${className}</option>`;
            }
        });
        subClassSection.classList.remove('hidden');
    } else {
        subClassSection.classList.add('hidden');
    }

    // โหลดเควสเลื่อนขั้น
    loadGuildQuests();
}

/**
 * โหลดเควสเลื่อนขั้น (ข้อ 10)
 */
function loadGuildQuests() {
    const listDiv = document.getElementById('guild-quest-list');
    listDiv.innerHTML = '<h4>เควสเลื่อนขั้น</h4>';
    let foundQuest = false;

    if (!guildQuests || Object.keys(guildQuests).length === 0) {
        listDiv.innerHTML += '<p><em>ยังไม่มีเควสเลื่อนขั้นจาก DM</em></p>';
        return;
    }

    for (const questId in guildQuests) {
        const quest = guildQuests[questId];
        
        // ตรวจสอบว่าเควสนี้ตรงกับ (อาชีพหลัก) และ (เลเวล) ของผู้เล่นหรือไม่
        if (quest.requiredClass === playerData.classMain && quest.requiredLevel <= playerData.level) {
            
            // (ตรวจสอบว่าผู้เล่นรับเควสนี้ไปหรือยัง)
            const playerHasQuest = (playerData.quest && playerData.quest.id === questId);
            const playerCompletedQuest = (playerData.completedQuests && playerData.completedQuests.includes(questId));

            let buttonHtml = '';
            if (playerCompletedQuest) {
                buttonHtml = '<button disabled style="background-color: #28a745;">สำเร็จแล้ว</button>';
            } else if (playerHasQuest) {
                buttonHtml = '<button disabled style="background-color: #ffc107; color: black;">รับแล้ว</button>';
            } else {
                buttonHtml = `<button onclick="acceptGuildQuest('${questId}')">รับเควส</button>`;
            }

            listDiv.innerHTML += `
                <div class="guild-quest">
                    <h4>${quest.title} (Lv.${quest.requiredLevel} ${quest.requiredClass})</h4>
                    <p>${quest.description}</p>
                    ${buttonHtml}
                </div>
            `;
            foundQuest = true;
        }
    }

    if (!foundQuest) {
        listDiv.innerHTML += '<p><em>ไม่มีเควสเลื่อนขั้นสำหรับคุณในตอนนี้</em></p>';
    }
}

/**
 * รับเควสเลื่อนขั้น (ข้อ 10)
 */
async function acceptGuildQuest(questId) {
    if (!guildQuests[questId]) return;
    
    // (ตรวจสอบว่ามีเควสอยู่แล้วหรือไม่)
    if (playerData.quest) {
        return Swal.fire('ผิดพลาด', 'คุณมีเควสอื่นค้างอยู่ กรุณาส่งเควสเก่าก่อน', 'warning');
    }
    
    const questData = {
        id: questId, // (บันทึก ID เควส)
        title: guildQuests[questId].title,
        detail: guildQuests[questId].description,
        reward: "เลื่อนขั้นอาชีพ",
        expReward: 0,
        isGuildQuest: true // (ระบุว่าเป็นเควสเลื่อนขั้น)
    };

    try {
        await playerRef.child('quest').set(questData);
        Swal.fire('สำเร็จ', `รับเควส "${questData.title}" แล้ว!`, 'success');
        loadGuildQuests(); // (รีเฟรช UI)
    } catch (error) {
        Swal.fire('ผิดพลาด', 'ไม่สามารถรับเควสได้: ' + error.message, 'error');
    }
}

/**
 * ลงทะเบียนอาชีพรอง (ข้อ 10)
 */
async function registerSubClass() {
    const selectedClass = document.getElementById('subclass-select').value;
    if (!selectedClass) {
        return Swal.fire('ผิดพลาด', 'กรุณาเลือกอาชีพรอง', 'warning');
    }
    
    // (ตรวจสอบเงื่อนไขอีกครั้ง)
    if (playerData.level < 10 || playerData.classSub) {
         return Swal.fire('ผิดพลาด', 'คุณไม่ตรงตามเงื่อนไข (Level 10 และยังไม่มีอาชีพรอง)', 'error');
    }
    
    // (ตรวจสอบอาชีพลับ - นักดาบเวทย์)
    if ( (playerData.classMain === 'นักรบ' && selectedClass === 'นักเวท') ||
         (playerData.classMain === 'นักเวท' && selectedClass === 'นักรบ') ) {
        
        Swal.fire({
            title: 'อาชีพลับ!',
            text: `การผสมผสานระหว่าง "นักรบ" และ "นักเวท" ทำให้คุณปลดล็อคอาชีพลับ "นักดาบเวทย์"! คุณต้องการเปลี่ยนอาชีพหลักเป็น "นักดาบเวทย์" หรือไม่? (อาชีพรองของคุณจะหายไป)`,
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: 'ใช่, ฉันจะเป็นนักดาบเวทย์!',
            cancelButtonText: 'ไม่, ฉันจะเลือกอาชีพรองอื่น'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await playerRef.update({
                    classMain: 'นักดาบเวทย์',
                    classSub: null // (อาชีพลับจะแทนที่อาชีพหลัก)
                });
                Swal.fire('สำเร็จ!', 'คุณได้เปลี่ยนเป็น "นักดาบเวทย์" แล้ว!', 'success');
                hideMapUI();
            }
        });
        
    } else {
        // (อาชีพรองทั่วไป)
        try {
            await playerRef.child('classSub').set(selectedClass);
            Swal.fire('สำเร็จ', `คุณได้เลือกอาชีพรองเป็น "${selectedClass}" แล้ว!`, 'success');
            hideMapUI();
        } catch (error) {
            Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกอาชีพรองได้: ' + error.message, 'error');
        }
    }
}

// =================================================================================
// 3. Inn Logic (ข้อ 10)
// [ ⭐️ KONGFA-FIX ⭐️ ] แก้ไขให้เรียกใช้ calculateTotalStat (ฟังก์ชันใหม่)
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

function loadInnUI() {
    const btn = document.getElementById('btn-rest');
    if (!playerData) return; // (ป้องกัน Error ถ้าข้อมูลยังไม่โหลด)

    if (btn) {
        btn.textContent = `พักผ่อน (ราคา 10 GP) - (คุณมี ${playerData.gp || 0} GP)`;
        btn.disabled = (playerData.gp || 0) < 10;
    }
}

async function restAtInn() {
    const restCost = 10;
    
    Swal.fire({
        title: 'พักผ่อน?',
        text: `คุณต้องการใช้ ${restCost} GP เพื่อฟื้นฟู HP จนเต็มหรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช่, พักผ่อน',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading("กำลังพักผ่อน...");
            
            playerRef.transaction(currentData => {
                if (!currentData) return;
                
                if (currentData.gp < restCost) {
                    // (ป้องกันกรณีกดซ้ำ)
                    setTimeout(() => Swal.fire('ผิดพลาด', 'เงินไม่พอ!', 'error'), 100);
                    return; // (ยกเลิก Transaction)
                }
                
                // 1. หักเงิน
                currentData.gp -= restCost;
                
                // 2. [ ⭐️ KONGFA-FIX ⭐️ ]
                // คำนวณ MaxHP (ต้องใช้ charector.js และฟังก์ชัน v3.1)
                // (ใช้ฟังก์ชันใหม่ที่ถูกต้อง)
                const currentCon = calculateTotalStat(currentData, 'CON');
                const maxHp = calcHPFn(currentData.race, currentData.classMain, currentCon);
                
                // 3. เติม HP
                currentData.hp = maxHp;
                
                // 4. (ในอนาคต) ล้างคูลดาวน์ PERSONAL
                
                return currentData;
                
            }).then((result) => {
                if (result.committed) {
                    hideLoading();
                    Swal.fire('สดชื่น!', 'พักผ่อนเต็มอิ่มแล้ว HP ฟื้นฟูจนเต็ม!', 'success');
                    loadInnUI(); // (อัปเดตปุ่ม)
                } else {
                    hideLoading();
                }
            }).catch(error => {
                hideLoading();
                Swal.fire('ผิดพลาด', 'ไม่สามารถพักผ่อนได้: ' + error.message, 'error');
            });
        }
    });
}

// =================================================================================
// 4. Shop Logic (ข้อ 10, 11)
// [ ⭐️ KONGFA-FIX (Bug 5 + New Bug) ⭐️ ]
// =================================================================================

/**
 * เปิด UI ร้านค้า (ดึงข้อมูลจาก DM)
 */
async function openShop(shopId) {
    showBuildingUI('shop_items'); // (แสดง Panel ร้านค้า)
    const titleEl = document.getElementById('shop-title');
    const listDiv = document.getElementById('shop-item-list');
    
    const shopName = document.querySelector(`button[onclick="openShop('${shopId}')"]`).textContent;
    titleEl.textContent = shopName;
    listDiv.innerHTML = '<p>กำลังโหลดสินค้า...</p>';

    const currentShopData = shopData[shopId];
    if (!currentShopData || Object.keys(currentShopData).length === 0) {
        listDiv.innerHTML = '<p><em>ร้านนี้ยังไม่มีสินค้า (รอ DM เพิ่มของ)</em></p>';
        return;
    }

    listDiv.innerHTML = '';
    const playerGP = playerData?.gp || 0;

    for (const itemId in currentShopData) {
        const item = currentShopData[itemId];
        const canBuy = playerGP >= item.price;
        
        let statsHtml = '';
        if (item.bonuses && Object.keys(item.bonuses).length > 0) {
            statsHtml += '<ul>';
            for (const stat in item.bonuses) {
                statsHtml += `<li>${stat}: +${item.bonuses[stat]}</li>`;
            }
            statsHtml += '</ul>';
        }

        // [ ⭐️ KONGFA-FIX (Bug 5) ⭐️ ] แสดงผล Effects (ถ้ามี)
        if (item.effects) {
             statsHtml += '<ul>';
             if(item.effects.heal) statsHtml += `<li>ฟื้นฟู HP: ${item.effects.heal}</li>`;
             if(item.effects.permStats) item.effects.permStats.forEach(p => statsHtml += `<li>(ถาวร) ${p.stat}: +${p.amount}</li>`);
             if(item.effects.tempStats) item.effects.tempStats.forEach(t => statsHtml += `<li>(ชั่วคราว) ${t.stat}: +${t.amount} (${t.turns} เทิร์น)</li>`);
             statsHtml += '</ul>';
        }

        listDiv.innerHTML += `
            <div class="shop-item">
                <h4>${item.name}</h4>
                <p>ประเภท: ${item.itemType || 'ทั่วไป'}</p>
                <p>ความทนทาน: ${item.durability || 100}%</p>
                ${statsHtml}
                <p class="price">${item.price} GP</p>
                <button onclick="buyItem('${shopId}', '${itemId}')" ${canBuy ? '' : 'disabled'}>
                    ${canBuy ? 'ซื้อ' : 'เงินไม่พอ'}
                </button>
            </div>
        `;
    }
}

/**
 * ซื้อไอเทม (ข้อ 11)
 * [ ⭐️ KONGFA-FIX (Bug 5 + New Bug) ⭐️ ]
 */
async function buyItem(shopId, itemId) {
    const item = shopData[shopId]?.[itemId];
    if (!item) return Swal.fire('ผิดพลาด', 'ไม่พบไอเทมนี้ในร้านค้า!', 'error');
    
    const price = item.price;

    showLoading(`กำลังซื้อ ${item.name}...`);

    playerRef.transaction(currentData => {
        if (!currentData) return;
        
        const playerGP = currentData.gp || 0;
        if (playerGP < price) {
            setTimeout(() => Swal.fire('ผิดพลาด', 'เงินไม่พอ!', 'error'), 100);
            return; // (ยกเลิก Transaction)
        }
        
        // 1. หักเงิน
        currentData.gp -= price;
        
        // 2. สร้างไอเทมใหม่
        const itemToBuy = {
            name: item.name,
            quantity: 1,
            durability: item.durability || 100,
            itemType: item.itemType || 'ทั่วไป',
            bonuses: item.bonuses ? { ...item.bonuses } : {},
            originalBonuses: item.originalBonuses ? { ...item.originalBonuses } : (item.bonuses ? { ...item.bonuses } : {})
        };
        
        // (เพิ่มข้อมูลเฉพาะประเภท)
        if (item.itemType === 'สวมใส่') itemToBuy.slot = item.slot;
        if (item.itemType === 'อาวุธ') {
            itemToBuy.damageDice = item.damageDice;
            itemToBuy.weaponType = item.weaponType;
            itemToBuy.recommendedClass = item.recommendedClass || [];
        }
        // [ ⭐️ KONGFA-FIX (New Bug) ⭐️ ]
        // คัดลอก 'effects' สำหรับไอเทมบริโภค (ยา)
        if (item.itemType === 'บริโภค' && item.effects) {
            itemToBuy.effects = JSON.parse(JSON.stringify(item.effects));
        }

        // 3. เพิ่มเข้า Inventory
        if (!currentData.inventory) currentData.inventory = [];
        
        // [ ⭐️ KONGFA-FIX (Bug 5) ⭐️ ]
        // (ตรรกะ Stack ไอเทม - เฉพาะไอเทมที่ไม่มีโบนัส และ ไม่มีเอฟเฟกต์)
        const hasBonuses = itemToBuy.bonuses && Object.keys(itemToBuy.bonuses).length > 0;
        const hasEffects = itemToBuy.effects && (
            (itemToBuy.effects.heal && itemToBuy.effects.heal > 0) ||
            (itemToBuy.effects.permStats && itemToBuy.effects.permStats.length > 0) ||
            (itemToBuy.effects.tempStats && itemToBuy.effects.tempStats.length > 0)
        );
        
        const isStackable = (itemToBuy.itemType === 'ทั่วไป' || itemToBuy.itemType === 'บริโภค') && !hasBonuses && !hasEffects;
        let found = false;
        
        if (isStackable) {
            for (let i = 0; i < currentData.inventory.length; i++) {
                const invItem = currentData.inventory[i];
                // (ตรวจสอบว่าไอเทมในช่องเก็บของ stack ได้หรือไม่)
                const invHasBonuses = invItem.bonuses && Object.keys(invItem.bonuses).length > 0;
                const invHasEffects = invItem.effects && (
                    (invItem.effects.heal && invItem.effects.heal > 0) ||
                    (invItem.effects.permStats && invItem.effects.permStats.length > 0) ||
                    (invItem.effects.tempStats && invItem.effects.tempStats.length > 0)
                );

                if (invItem.name === itemToBuy.name && !invHasBonuses && !invHasEffects) {
                    invItem.quantity += 1;
                    found = true;
                    break;
                }
            }
        }
        
        if (!found) {
            currentData.inventory.push(itemToBuy);
        }
        
        return currentData;
        
    }).then((result) => {
        hideLoading();
        if (result.committed) {
            Swal.fire('สำเร็จ', `ซื้อ ${item.name} สำเร็จ!`, 'success');
            // (รีเฟรช UI ร้านค้า เพื่ออัปเดตสถานะปุ่ม 'เงินไม่พอ')
            openShop(shopId);
        }
    }).catch(error => {
        hideLoading();
        Swal.fire('ผิดพลาด', 'ไม่สามารถซื้อไอเทมได้: ' + error.message, 'error');
    });
}

// =================================================================================
// 5. Initializer
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

window.onload = function() {
    if (!roomId || !currentUserUid) {
        Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้หรือห้อง! กำลังกลับไปที่ล็อบบี้...', 'error');
        setTimeout(() => window.location.href = 'lobby.html', 2000);
        return;
    }
    
    playerRef = db.ref(`rooms/${roomId}/playersByUid/${currentUserUid}`);
    roomRef = db.ref(`rooms/${roomId}`);

    // 1. ฟังข้อมูลผู้เล่น (สำหรับ GP, Level, Class)
    playerRef.on('value', (snapshot) => {
        if (!snapshot.exists()) {
            // (กรณีที่ DM ลบตัวละคร)
            Swal.fire('ไม่พบตัวละคร', 'ไม่พบข้อมูลตัวละครของคุณในห้องนี้ กำลังกลับไปที่ล็อบบี้...', 'warning');
            setTimeout(() => window.location.href = 'lobby.html', 2000);
            return;
        }
        playerData = snapshot.val();
        
        // (อัปเดต UI ที่อาจจะเปิดค้างอยู่)
        if (document.getElementById('guild-panel').classList.contains('hidden') === false) {
            loadGuildUI();
        }
        if (document.getElementById('inn-panel').classList.contains('hidden') === false) {
            loadInnUI();
        }
    });

    // 2. ฟังข้อมูลกิลด์ (สำหรับเควสเลื่อนขั้น)
    roomRef.child('guild/quests').on('value', (snapshot) => {
        guildQuests = snapshot.val() || {};
        // (อัปเดต UI ถ้าเปิดค้างอยู่)
        if (playerData && document.getElementById('guild-panel').classList.contains('hidden') === false) {
            loadGuildQuests();
        }
    });

    // 3. ฟังข้อมูลร้านค้า (สำหรับไอเทม)
    roomRef.child('shops').on('value', (snapshot) => {
        shopData = snapshot.val() || {};
        // (ไม่ต้องทำอะไรจนกว่าผู้เล่นจะกดเปิดร้าน)
    });

    // (แสดง UI เริ่มต้น)
    showMapUI('building');
};