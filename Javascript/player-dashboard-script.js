/*
* =================================================================
* Javascript/player-dashboard-script.js (v3.2 - KONGFA FIX)
* -----------------------------------------------------------------
* นี่คือ "สมอง" ของหน้าแดชบอร์ดผู้เล่น (ข้อ 5)
*
* [ ⭐️ KONGFA-FIX ⭐️ ]
* 1. [เพิ่ม] ระบบความทนทาน (Durability) ที่ซับซ้อน:
* - สร้างฟังก์ชัน `applyDurabilityDamage` เพื่อจัดการการลดความทนทาน
* - แก้ไข `handlePendingAttack` (Block/Dodge) ใหม่ทั้งหมด:
* - [แก้ไขบั๊ก] แก้ไขการอ่านค่า initialDamage จาก attackData
* - เพิ่มปุ่ม "ป้องกัน (มือหลัก)" และ "ป้องกัน (มือรอง)"
* - ใช้ `applyDurabilityDamage` ตามกฎใหม่ (ป้องกันสำเร็จ/พลาด, หลบ, โดนโจมตี)
* 2. [ลบ] ย้าย `performAttackRoll`, `performDamageRoll`, `equipItem`, `unequipItem`
* - ฟังก์ชันเหล่านี้ถูกย้ายไป `player-actions.js` (v3.2) แล้ว
* 3. [แก้ไข] `displayInventory`:
* - อัปเดต `onclick` ให้ส่ง `index` ของไอเทม เพื่อให้ `useConsumableItem`
* และ `equipItem` ทำงานกับไอเทมที่ซ้อนกัน (stack) ได้ถูกต้อง
* 4. [แก้ไขบั๊ก] `calculateTotalStat` ให้อ่าน Passive จาก 'skillTrigger'
* =================================================================
*/

// --- Global State ---
let allPlayersInRoom = {};
let allEnemiesInRoom = {};
let combatState = {};
let currentCharacterData = null; // ข้อมูลตัวละครของผู้เล่นคนนี้ (อัปเดตตลอด)

// --- Utility & Calculation Functions (ต้องโหลดก่อนไฟล์นี้) ---
const calcHPFn = typeof calculateHP === 'function' ? calculateHP : () => { console.error("calculateHP not found!"); return 10; };
const getStatBonusFn = typeof getStatBonus === 'function' ? getStatBonus : () => { console.error("getStatBonus not found!"); return 0; };
const showAlert = typeof showCustomAlert === 'function' ? showCustomAlert : (msg, type) => { console.log(type + ':', msg); };


/**
 * [อัปเกรด v3.1] คำนวณสเตตัสรวม (Final Stat)
 * [ ⭐️ KONGFA-FIX (Bug 4) ⭐️ ] แก้ไขการดึง Passive (ส่วนที่ 3)
 */
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
    // ⭐️ [แก้ไข] ดึง Passives จาก RACE_DATA และ CLASS_DATA (ซึ่งอาจมีผลต่อ Stat หรือไม่ก็ได้)
    const raceId = charData.raceEvolved || charData.race;
    const racePassives = (typeof RACE_DATA !== 'undefined' && RACE_DATA[raceId]?.passives) ? RACE_DATA[raceId].passives : [];
    
    const classMainId = charData.classMain;
    // ⭐️ [แก้ไข] CLASS_DATA เก็บ passives ใน array ชื่อ 'passives' (เช่น อัศวิน)
    const classPassives = (typeof CLASS_DATA !== 'undefined' && CLASS_DATA[classMainId]?.passives) ? CLASS_DATA[classMainId].passives : [];
    
    const classSubId = charData.classSub;
    const subClassPassives = (typeof CLASS_DATA !== 'undefined' && CLASS_DATA[classSubId]?.passives) ? CLASS_DATA[classSubId].passives : [];
    
    const skillPassives = [];
    if (typeof SKILL_DATA !== 'undefined') {
        // ⭐️ [แก้ไข] SKILL_DATA เก็บ passives โดยใช้ 'skillTrigger'
        if(SKILL_DATA[classMainId]) {
            skillPassives.push(...SKILL_DATA[classMainId].filter(s => s.skillTrigger === 'PASSIVE'));
        }
        if(SKILL_DATA[classSubId]) {
            skillPassives.push(...SKILL_DATA[classSubId].filter(s => s.skillTrigger === 'PASSIVE'));
        }
    }

    const allPassives = [...racePassives, ...classPassives, ...subClassPassives, ...skillPassives];
    
    // ⭐️ [แก้ไข] วนลูปเช็ค 'effect' ที่ถูกต้อง
    allPassives.forEach(passiveOrSkill => {
        // (หา object ที่เก็บ effect)
        let effectObject = null;
        if (passiveOrSkill.skillTrigger === 'PASSIVE') {
            // นี่คือสกิลจาก SKILL_DATA (เช่น นักดาบเวทย์)
            effectObject = passiveOrSkill.effect;
        } else if (passiveOrSkill.id && passiveOrSkill.effect) {
            // นี่คือสกิลจาก RACE_DATA หรือ CLASS_DATA (ถ้ามี .effect)
            effectObject = passiveOrSkill.effect;
        }
        
        // (ถ้าหาเจอ)
        if (effectObject) {
            // (ตรวจสอบว่า effect เป็น array หรือ object เดียว)
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
    
    // 5. [v3] คำนวณโบนัสจากออร่า
    if (typeof allPlayersInRoom !== 'undefined') {
        for (const uid in allPlayersInRoom) {
            // (ไม่รับออร่าจากตัวเอง หรือคนที่ตายแล้ว)
            if (uid === charData.uid || !allPlayersInRoom[uid] || allPlayersInRoom[uid].hp <= 0) continue;

            const teammate = allPlayersInRoom[uid];
            const teammateClassId = teammate.classMain;
            // ⭐️ [แก้ไข] ดึง Passive จาก SKILL_DATA ให้ถูกวิธี
            const teammatePassives = (typeof SKILL_DATA !== 'undefined' && SKILL_DATA[teammateClassId]) 
                                     ? SKILL_DATA[teammateClassId].filter(s => s.skillTrigger === 'PASSIVE') : [];
                                     
            teammatePassives.forEach(skill => {
                // ⭐️ [แก้ไข] วนลูปเช็ค 'effect' ที่ถูกต้อง
                const effects = Array.isArray(skill.effect) ? skill.effect : [skill.effect];
                effects.forEach(p => {
                    if (p && p.type === 'AURA_STAT_PERCENT' && (p.stats?.includes(upperStatKey) || p.stats?.includes('ALL'))) {
                        percentBonus += p.amount;
                    }
                });
            });
        }
    }

    // 6. คำนวณโบนัสจากอุปกรณ์ (Equipped Items)
    let equipBonus = 0;
    if (charData.equippedItems) {
        for (const slot in charData.equippedItems) {
            const item = charData.equippedItems[slot];
            // [ ⭐️ KONGFA-FIX ⭐️ ] ถ้าไอเทมพัง (0) โบนัสต้องไม่ทำงาน
            if (!item || !item.bonuses || item.bonuses[upperStatKey] === undefined || (item.durability !== undefined && item.durability <= 0)) continue;

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


// =================================================================
// ส่วนที่ 2: Display Functions (ฟังก์ชันแสดงผล UI) (ข้อ 5.2)
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================

const CHARACTER_INFO_HTML = `
    <h2>
        ข้อมูลตัวละคร
        <button onclick="toggleSectionVisibility('characterInfoPanel_body')" class="toggle-btn">ซ่อน</button>
    </h2>
    <div id="characterInfoPanel_body">
        <p><strong>ชื่อ:</strong> <span id="name"></span> (<span id="level"></span>)</p>
        <p><strong>เผ่า:</strong> <span id="race"></span></p>
        <p><strong>อาชีพหลัก:</strong> <span id="classMain"></span></p>
        <p><strong>อาชีพรอง:</strong> <span id="classSub"></span></p>
        
        <details class="info-details">
            <summary><strong>ข้อมูลกายภาพ/นิสัย (คลิกเพื่อดู)</strong></summary>
            <p><strong>อายุ:</strong> <span id="age"></span> | <strong>เพศ:</strong> <span id="gender"></span></p>
            <p><strong>สูง:</strong> <span id="height"></span> ซม. | <strong>หนัก:</strong> <span id="weight"></span> กก.</p>
            <p><strong>ลักษณะ:</strong> <span id="appearance"></span></p>
            <p><strong>นิสัย:</strong> <span id="personality"></span></p>
            <p><strong>ชอบ:</strong> <span id="likes"></span></p>
            <p><strong>เกลียด:</strong> <span id="dislikes"></span></p>
            <p><strong>ภูมิหลัง:</strong> <span id="background"></span></p>
        </details>
        
        <p><strong>พลังชีวิต:</strong> <span id="hp"></span></p>
        <p><strong>GP:</strong> <span id="gp"></span></p>
        <div style="margin: 5px 0;"><small><strong>EXP:</strong>
        <span id="exp">0</span> / <span id="expToNextLevel">300</span></small>
        </div>
        <div style="background-color: #333; border-radius: 5px; padding: 2px;">
            <div id="expBar" style="height: 8px; width: 0%; background-color: #00bcd4; border-radius: 3px; transition: width 0.5s ease-in-out;"></div>
        </div>
        
        <div class="stat-grid">
            <li>STR: <span id="str"></span></li>
            <li>DEX: <span id="dex"></span></li>
            <li>CON: <span id="con"></span></li>
            <li>INT: <span id="int"></span></li>
            <li>WIS: <span id="wis"></span></li>
            <li>CHA: <span id="cha"></span></li>
        </div>

        <div id="effectsContainer" style="margin-top: 15px;"></div>
    </div>
`;

function injectDashboardStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        .stat-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 5px;
            list-style: none;
            padding: 0;
            margin-top: 10px;
        }
        .stat-grid li {
            background: rgba(0,0,0,0.2);
            padding: 5px;
            border-radius: 4px;
            text-align: center;
        }
        .info-details {
            margin-top: 5px; 
            padding: 10px; 
            background: rgba(0,0,0,0.2); 
            border-radius: 5px;
        }
        .info-details p { margin: 2px 0; }
        .toggle-btn {
            float: right;
            padding: 2px 8px;
            font-size: 0.8em;
            background-color: #6c757d;
            margin-top: 0;
        }
        
        @keyframes stat-up-anim {
            0% { transform: scale(1); color: #00ff00; }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); color: inherit; }
        }
        @keyframes stat-down-anim {
            0% { transform: scale(1); color: #ff4d4d; }
            50% { transform: scale(0.8); }
            100% { transform: scale(1); color: inherit; }
        }
        .stat-change { animation-duration: 1.5s; animation-fill-mode: forwards; }
        .stat-up { animation-name: stat-up-anim; }
        .stat-down { animation-name: stat-down-anim; }
        
        .effect-buff, .effect-cooldown, .effect-passive, .effect-aura {
            margin: 4px 0;
            padding: 6px;
            border-radius: 4px;
            font-family: 'Prompt', sans-serif;
            font-size: 0.9em;
            opacity: 0;
            animation: fadeInEffect 0.5s forwards;
        }
        .effect-buff { background: rgba(0, 123, 255, 0.2); border-left: 3px solid #007bff; }
        .effect-cooldown { background: rgba(255, 193, 7, 0.2); border-left: 3px solid #ffc107; }
        .effect-passive { background: rgba(108, 117, 125, 0.2); border-left: 3px solid #6c757d; }
        .effect-aura { background: rgba(23, 162, 184, 0.2); border-left: 3px solid #17a2b8; }
        
        @keyframes fadeInEffect {
            from { opacity: 0; transform: translateX(-10px); }
            to { opacity: 1; transform: translateX(0); }
        }

        /* [ ⭐️ KONGFA-FIX ⭐️ ] สไตล์ปุ่ม Block หลายปุ่ม */
        .swal2-actions {
            display: flex;
            flex-wrap: wrap; /* ทำให้ปุ่มขึ้นบรรทัดใหม่ได้ */
            justify-content: center;
        }
        .swal2-styled {
            margin: 5px !important;
            flex: 1 1 auto; /* ให้ปุ่มยืดหดได้ */
        }
    `;
    document.head.appendChild(style);
}

function toggleSectionVisibility(elementId) {
    const body = document.getElementById(elementId);
    const button = body.previousElementSibling.querySelector('.toggle-btn');
    if (body.classList.contains('hidden')) {
        body.classList.remove('hidden');
        button.textContent = 'ซ่อน';
    } else {
        body.classList.add('hidden');
        button.textContent = 'แสดง';
    }
}

function updateCharacterStatsDisplay(charData) {
    if (!charData) return;
    
    const statsKeys = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    statsKeys.forEach(key => {
        const el = document.getElementById(key.toLowerCase());
        if(el) {
             const currentValue = parseInt(el.textContent || "0");
             const newValue = calculateTotalStat(charData, key); 
             
             if (newValue > currentValue) {
                 el.className = 'stat-change stat-up';
             } else if (newValue < currentValue) {
                 el.className = 'stat-change stat-down';
             }
             el.textContent = newValue;
             if (newValue !== currentValue) {
                 setTimeout(() => el.className = '', 1500); 
             }
        }
    });

    // อัปเดต HP (ใช้ฟังก์ชันจาก charector.js)
    const finalCon = calculateTotalStat(charData, 'CON');
    // [FIX] ใช้ maxHp ที่เก็บไว้ใน data (เผื่อโดนลดถาวร)
    const displayMaxHp = charData.maxHp || calcHPFn(charData.race, charData.classMain, finalCon);
    const hpEl = document.getElementById('hp');
    if (hpEl) {
        const currentHp = Math.min(charData.hp || 0, displayMaxHp);
        hpEl.textContent = `${currentHp} / ${displayMaxHp}`;
    }
    
    const permanentLevel = charData.level || 1;
    let tempLevel = 0;
    if (Array.isArray(charData.activeEffects)) {
         charData.activeEffects.forEach(effect => {
             if (effect.stat === 'Level' && effect.modType === 'FLAT') {
                 tempLevel += (effect.amount || 0);
             }
             if (effect.type === 'TEMP_LEVEL_PERCENT') {
                 tempLevel += Math.floor(permanentLevel * (effect.amount / 100));
             }
         });
    }
    
    const levelEl = document.getElementById('level');
    levelEl.textContent = `Lv. ${permanentLevel}`;
    if (tempLevel > 0) {
        levelEl.innerHTML += ` <span style="color: #00ff00;">(+${tempLevel})</span>`;
    } else if (tempLevel < 0) {
        levelEl.innerHTML += ` <span style="color: #ff4d4d;">(${tempLevel})</span>`;
    }
    
    document.getElementById('gp').textContent = `${charData.gp || 0} GP`;
    
    const currentExp = charData.exp || 0; 
    const expForNext = charData.expToNextLevel || 300;
    document.getElementById('exp').textContent = currentExp;
    document.getElementById('expToNextLevel').textContent = expForNext;
    document.getElementById('expBar').style.width = `${Math.min(100, (currentExp / expForNext) * 100)}%`;

    const upgradeButton = document.getElementById("goToStatsButton"); 
    const freePoints = charData.freeStatPoints || 0;
    if (upgradeButton) { 
        upgradeButton.style.display = freePoints > 0 ? 'block' : 'none'; 
        if (freePoints > 0) upgradeButton.textContent = `✨ อัปเกรดสถานะ (${freePoints} แต้ม) ✨`; 
    }
}

function displayActiveEffects(charData, combatState) {
    const container = document.getElementById("effectsContainer"); 
    if (!container) return; 
    
    container.innerHTML = "<h4>สถานะ/คูลดาวน์ (ข้อ 5.2)</h4>"; 
    let hasEffect = false;

    // 1. [v3] แสดง Passives
    const raceId = charData.raceEvolved || charData.race;
    const racePassives = (typeof RACE_DATA !== 'undefined' && RACE_DATA[raceId]?.passives) ? RACE_DATA[raceId].passives : [];
    racePassives.forEach(passive => {
        container.innerHTML += `<p class="effect-passive" title="${passive.description}"><strong>(เผ่า) ${passive.name}</strong></p>`;
        hasEffect = true;
    });
    
    const classMainId = charData.classMain;
    // ⭐️ [แก้ไข] ดึง Passives จาก CLASS_DATA (ถ้ามี)
    const classPassives = (typeof CLASS_DATA !== 'undefined' && CLASS_DATA[classMainId]?.passives) ? CLASS_DATA[classMainId].passives : [];
    classPassives.forEach(passive => {
        // (ไม่แสดง Aura ของตัวเอง)
        if (passive.effect?.type && passive.effect.type.startsWith('AURA')) return;
        container.innerHTML += `<p class="effect-passive" title="${passive.description || ''}"><strong>(อาชีพ) ${passive.name}</strong></p>`;
        hasEffect = true;
    });
    
    // ⭐️ [แก้ไข] ดึง Passives จาก SKILL_DATA
    const skillPassives = [];
    if (typeof SKILL_DATA !== 'undefined') {
        if(SKILL_DATA[classMainId]) {
            skillPassives.push(...SKILL_DATA[classMainId].filter(s => s.skillTrigger === 'PASSIVE'));
        }
    }
    skillPassives.forEach(skill => {
        // (ไม่แสดง Aura ของตัวเอง)
        if (skill.effect?.type && skill.effect.type.startsWith('AURA')) return; 
        container.innerHTML += `<p class="effect-passive" title="${skill.description}"><strong>(สกิล) ${skill.name}</strong></p>`;
        hasEffect = true;
    });


    // 2. [v3] แสดง Buffs/Debuffs (Active Effects)
    const effects = charData.activeEffects || []; 
    if (effects.length > 0) { 
        hasEffect = true; 
        effects.forEach(effect => { 
            const modText = effect.modType === 'PERCENT' ? `${effect.amount}%` : (effect.modType === 'SET_VALUE' ? `= ${effect.amount}` : `${effect.amount >= 0 ? '+' : ''}${effect.amount}`); 
            container.innerHTML += `<p class="effect-buff" title="จากสกิล: ${effect.skillId}"><strong>${effect.name || effect.skillId}</strong>: ${effect.stat} ${modText} (เหลือ ${effect.turnsLeft} เทิร์น)</p>`; 
        }); 
    }

    // 3. [v3] แสดง Cooldowns
    const cooldowns = charData.skillCooldowns || {}; 
    for (const skillId in cooldowns) {
        const cd = cooldowns[skillId];
        if (!cd) continue;
        
        if (cd.type === 'PERSONAL' && cd.turnsLeft > 0) {
            hasEffect = true;
            const skillName = SKILL_DATA[charData.classMain]?.find(s=>s.id===skillId)?.name || skillId;
            container.innerHTML += `<p class="effect-cooldown"><strong>(CD) ${skillName}</strong>: (รอ ${cd.turnsLeft} เทิร์น)</p>`;
        }
        else if (cd.type === 'PER_COMBAT' && cd.usesLeft <= 0) { 
             hasEffect = true;
             const skillName = SKILL_DATA[charData.classMain]?.find(s=>s.id===skillId)?.name || skillId;
             container.innerHTML += `<p class="effect-cooldown"><strong>(CD) ${skillName}</strong>: (ใช้ครบโควต้า)</p>`;
        }
    }
    
    // 4. [v3] แสดง Auras ที่ได้รับจากเพื่อน
    if (typeof allPlayersInRoom !== 'undefined') {
        for (const uid in allPlayersInRoom) {
            if (uid === charData.uid || !allPlayersInRoom[uid] || allPlayersInRoom[uid].hp <= 0) continue;
            
            const teammate = allPlayersInRoom[uid];
            const teammateClassId = teammate.classMain;
            // ⭐️ [แก้ไข] ดึง Passives จาก SKILL_DATA ให้ถูกวิธี
            const teammatePassives = (typeof SKILL_DATA !== 'undefined' && SKILL_DATA[teammateClassId]) 
                                     ? SKILL_DATA[teammateClassId].filter(s => s.skillTrigger === 'PASSIVE') : [];
                                     
            teammatePassives.forEach(skill => {
                // ⭐️ [แก้ไข] วนลูปเช็ค 'effect' ที่ถูกต้อง
                const effects = Array.isArray(skill.effect) ? skill.effect : [skill.effect];
                effects.forEach(p => {
                    if (p && p.type === 'AURA_STAT_PERCENT') {
                         container.innerHTML += `<p class="effect-aura" title="จาก ${teammate.name}"><strong>(ออร่า) ${skill.name}</strong>: (${p.stats.join(', ')} +${p.amount}%)</p>`;
                         hasEffect = true;
                    }
                });
            });
        }
    }
    
    if (!hasEffect) container.innerHTML += "<p><small><em>ไม่มีสถานะหรือคูลดาวน์</em></small></p>";
}

function displayCharacter(character, combatState) {
    const infoPanel = document.getElementById("characterInfoPanel"); 
    if (infoPanel && !infoPanel.querySelector('#name')) {
        infoPanel.innerHTML = CHARACTER_INFO_HTML;
    }

    document.getElementById("name").textContent = character.name || "-"; 
    document.getElementById("race").textContent = character.raceEvolved || character.race || "-"; 
    document.getElementById("classMain").textContent = character.classMain || "-";
    document.getElementById("classSub").textContent = character.classSub || "ยังไม่มี";
    document.getElementById("age").textContent = character.info?.age || "-";
    document.getElementById("gender").textContent = character.gender || "-";
    document.getElementById("height").textContent = character.info?.height || "-";
    document.getElementById("weight").textContent = character.info?.weight || "-";
    document.getElementById("appearance").textContent = character.info?.appearance || "-";
    document.getElementById("personality").textContent = character.info?.personality || "-";
    document.getElementById("likes").textContent = character.info?.likes || "-";
    document.getElementById("dislikes").textContent = character.info?.dislikes || "-";
    document.getElementById("background").textContent = character.background || "-";

    updateCharacterStatsDisplay(character); 
    displayActiveEffects(character, combatState);
}

/**
 * [ ⭐️ KONGFA-FIX ⭐️ ] อัปเดต UI ไอเทม ให้ส่ง Index
 */
function displayInventory(inventory = []) { 
    const list = document.getElementById("inventory"); 
    if(!list) return; 
    list.innerHTML = inventory.length === 0 ? "<li>ยังไม่มีไอเทม</li>" : ""; 
    
    inventory.forEach((item, index) => { // (เพิ่ม index)
        if (!item || !item.name) return; 
        
        const li = document.createElement("li"); 
        let itemText = `${item.name} (x${item.quantity})`;
        
        // [FIX] แสดงความทนทาน
        if (item.durability !== undefined) {
             if (item.durability <= 0) {
                 itemText += ` <span style="color: #dc3545; font-weight: bold;">[พัง 0%]</span>`;
             } else {
                itemText += ` [${item.durability}%]`;
             }
        }
        
        // [FIX] ส่ง index แทน name ไปยังฟังก์ชันใน player-actions.js
        if (item.itemType === 'สวมใส่' || item.itemType === 'อาวุธ') {
            // (เพิ่มเงื่อนไข: ถ้าพังแล้ว ห้ามสวมใส่)
            if (item.durability === undefined || item.durability > 0) {
                 itemText += ` <button onclick="equipItem(${index})" style="margin-left: 10px; padding: 2px 8px; font-size: 0.8em;">สวมใส่</button>`; 
            }
        } else if (item.itemType === 'บริโภค') {
            itemText += ` <button onclick="useConsumableItem(${index})" style="margin-left: 10px; padding: 2px 8px; font-size: 0.8em; background-color: #28a745;">ใช้</button>`;
        }
        
        li.innerHTML = itemText; 
        list.appendChild(li); 
    }); 
}

/**
 * [ ⭐️ KONGFA-FIX ⭐️ ] อัปเดต UI ของสวมใส่ ให้แสดง "พัง"
 */
function displayEquippedItems(equipped = {}) { 
    const slots = ['mainHand', 'offHand', 'head', 'chest', 'legs', 'feet']; 
    slots.forEach(slot => { 
        const item = equipped[slot]; 
        const el = document.getElementById(`eq-${slot}`); 
        const btn = el?.nextElementSibling; 
        
        if (el) {
            let itemText = item?.name || '-';
            // [FIX] แสดงความทนทาน
            if (item && item.durability !== undefined) {
                if (item.durability <= 0) {
                     itemText += ` <span style="color: #dc3545; font-weight: bold;">[พัง 0%]</span>`;
                } else {
                    let color = item.durability > 30 ? '#00ff00' : (item.durability > 10 ? '#ffc107' : '#dc3545');
                    itemText += ` <span style="color: ${color}; font-weight: bold;">[${item.durability}%]</span>`;
                }
            }
            el.innerHTML = itemText;
        }
        
        // [FIX] ซ่อนปุ่ม "ถอด" ถ้าไม่มีไอเทม
        if (btn) btn.style.display = item ? 'inline-block' : 'none'; 
    }); 
}


function displayTeammates(currentUserUid) {
    const select = document.getElementById('teammateSelect');
    select.innerHTML = '<option value="">-- เลือกดูข้อมูล --</option>';
    for (const uid in allPlayersInRoom) {
        if (uid !== currentUserUid) {
            select.innerHTML += `<option value="${uid}">${allPlayersInRoom[uid].name}</option>`;
        }
    }
}

function showTeammateInfo() {
    const uid = document.getElementById('teammateSelect').value;
    const infoDiv = document.getElementById('teammateInfo');
    if (!uid) {
        infoDiv.innerHTML = '<p>เลือกเพื่อนร่วมทีมเพื่อดูข้อมูล</p>';
        return;
    }
    const player = allPlayersInRoom[uid];
    if (player) {
        const finalCon = calculateTotalStat(player, 'CON');
        const maxHp = calcHPFn(player.race, player.classMain, finalCon);
        infoDiv.innerHTML = `
            <p><strong>${player.name} (Lv. ${player.level})</strong></p>
            <p><strong>HP:</strong> ${player.hp} / ${maxHp}</p>
            <p><strong>เผ่า:</strong> ${player.raceEvolved || player.race}</p>
            <p><strong>อาชีพ:</strong> ${player.classMain}</p>
        `;
    }
}

function displayQuest(quest) {
    document.getElementById('questTitle').textContent = quest?.title || '-';
    document.getElementById('questDetail').textContent = quest?.detail || '-';
    document.getElementById('questReward').textContent = quest?.reward || '-';
}

function displayStory(story) {
    document.getElementById('story').textContent = story || 'ยังไม่มีเนื้อเรื่อง';
}

function displayEnemies(enemies, currentUserUid) {
    const container = document.getElementById('enemyPanelContainer');
    const targetSelect = document.getElementById('enemyTargetSelect');
    container.innerHTML = '';
    targetSelect.innerHTML = '';
    
    let hasEnemies = false;
    for (const key in enemies) {
        const enemy = enemies[key];
        if (enemy.hp > 0) {
            hasEnemies = true;
            container.innerHTML += `<p>${enemy.name} (HP: ${enemy.hp})</p>`;
            targetSelect.innerHTML += `<option value="${key}">${enemy.name}</option>`;
        }
    }
    
    if (!hasEnemies) {
        container.innerHTML = '<p><em>ไม่มีศัตรูที่กำลังต่อสู้กับคุณ</em></p>';
    }
}

function updateTurnDisplay(combatState, currentUserUid) {
    const indicator = document.getElementById('turnIndicator');
    if (combatState.isActive) {
        const currentUnit = combatState.turnOrder[combatState.currentTurnIndex];
        const isMyTurn = currentUnit.id === currentUserUid;
        
        indicator.textContent = isMyTurn ? '⚔️ เทิร์นของคุณ ⚔️' : `เทิร์นของ: ${currentUnit.name}`;
        indicator.className = isMyTurn ? 'my-turn' : 'other-turn';
        indicator.classList.remove('hidden');
        
        document.getElementById('attackRollButton').disabled = !isMyTurn;
        document.getElementById('skillButton').disabled = !isMyTurn;
        
    } else {
        indicator.classList.add('hidden');
        document.getElementById('attackRollButton').disabled = true;
        document.getElementById('skillButton').disabled = true;
        document.getElementById('damageRollSection').style.display = 'none';
    }
}

async function playerRollDice() {
    const diceType = parseInt(document.getElementById("diceType").value);
    const diceCount = parseInt(document.getElementById("diceCount").value);
    const rollButton = document.querySelector('button[onclick="playerRollDice()"]');
    
    const { results, total } = await showDiceRollAnimation(diceCount, diceType, 'player-dice-animation-area', 'dice-result', rollButton);
    
    const roomId = sessionStorage.getItem('roomId');
    const player = currentCharacterData;
    if (roomId && player) {
        const log = {
            name: player.name,
            type: 'general',
            count: diceCount,
            dice: diceType,
            result: results,
            timestamp: new Date().toISOString()
        };
        db.ref(`rooms/${roomId}/diceLogs`).push(log);
    }
}


// =================================================================
// [ ⭐️ KONGFA-FIX ⭐️ ]
// ส่วนที่ 3: Block/Dodge และตรรกะความทนทาน
// =================================================================

/**
 * [ ⭐️ KONGFA-FIX ⭐️ ]
 * ฟังก์ชันใหม่สำหรับจัดการการลดความทนทาน
 * @param {object} updates - Object ที่จะส่งไป update Firebase
 * @param {object} equippedItems - ไอเทมสวมใส่ปัจจุบัน
 * @param {string} type - ประเภทการลด (BLOCK_SUCCESS, BLOCK_FAIL, DODGE, TAKE_HIT)
 * @param {object} options - ข้อมูลเพิ่มเติม { damageReduced, damageTaken, weaponSlot }
 */
function applyDurabilityDamage(updates, equippedItems, type, options = {}) {
    console.log(`[Durability] Applying damage type: ${type}`, options);
    
    // (ฟังก์ชันเสริมสำหรับสุ่มเกราะ)
    const getRandomArmor = (slots) => {
        const availableSlots = slots.filter(s => equippedItems[s] && (equippedItems[s].durability === undefined || equippedItems[s].durability > 0));
        if (availableSlots.length === 0) return null;
        return availableSlots[Math.floor(Math.random() * availableSlots.length)];
    };

    switch (type) {
        // 1. ป้องกันสำเร็จ: ลดความทนทานอาวุธที่ใช้ป้องกัน
        case 'BLOCK_SUCCESS':
            const { damageReduced, weaponSlot } = options;
            if (weaponSlot && equippedItems[weaponSlot]) {
                const item = equippedItems[weaponSlot];
                // (ป้องกันความเสียหายเท่าไหร่ ลดเท่านั้น)
                const newDura = Math.max(0, (item.durability || 100) - damageReduced);
                updates[`equippedItems/${weaponSlot}/durability`] = newDura;
                console.log(`[Durability] ${item.name} blocked ${damageReduced} damage. New dura: ${newDura}`);
            }
            break;

        // 2. ป้องกันพลาด: สุ่มลดความทนทานเกราะ 1-2 ชิ้น (ครึ่งนึงของความเสียหาย)
        case 'BLOCK_FAIL':
            const { damageTaken } = options;
            const duraLossArmor = Math.ceil(damageTaken / 2); // (ครึ่งนึง ปัดขึ้น)
            
            let armorSlots = ['head', 'chest', 'legs', 'feet'];
            const piecesToDamage = (armorSlots.filter(s => equippedItems[s] && (equippedItems[s].durability === undefined || equippedItems[s].durability > 0)).length >= 2) ? 2 : 1;
            
            console.log(`[Durability] Block failed. Damaging ${piecesToDamage} armor pieces by ${duraLossArmor} dura.`);
            
            for (let i = 0; i < piecesToDamage; i++) {
                const randomSlot = getRandomArmor(armorSlots); // (สุ่มจาก 4 ชิ้น)
                if (randomSlot) {
                    const item = equippedItems[randomSlot];
                    const newDura = Math.max(0, (item.durability || 100) - duraLossArmor);
                    updates[`equippedItems/${randomSlot}/durability`] = newDura;
                    console.log(`[Durability] ${item.name} takes ${duraLossArmor} dura damage. New dura: ${newDura}`);
                    // (ลบออกจาก pool ป้องกันการสุ่มซ้ำ)
                    armorSlots = armorSlots.filter(s => s !== randomSlot); 
                }
            }
            break;

        // 3. หลบหลีก (พลาดหรือไม่ก็ตาม): ลดความทนทานรองเท้า
        case 'DODGE':
            if (equippedItems['feet'] && (equippedItems['feet'].durability === undefined || equippedItems['feet'].durability > 0)) {
                const item = equippedItems['feet'];
                const duraLossDodge = 3; // (ปัดเศษ 2.5% เป็น 3)
                const newDura = Math.max(0, (item.durability || 100) - duraLossDodge);
                updates[`equippedItems/feet/durability`] = newDura;
                console.log(`[Durability] Dodge attempt. ${item.name} loses ${duraLossDodge} dura. New dura: ${newDura}`);
            }
            break;

        // 4. โดนโจมตี (ไม่ป้องกัน): สุ่มลดเกราะอก/กางเกง
        case 'TAKE_HIT':
            const { damageTaken: damageTakenHit } = options; // (เปลี่ยนชื่อตัวแปร)
            const duraLossHit = Math.ceil(damageTakenHit / 2); // (ครึ่งนึงของความเสียหาย)
            
            const randomBodySlot = getRandomArmor(['chest', 'legs']); // (สุ่มเฉพาะ อก/กางเกง)
            
            if (randomBodySlot) {
                const item = equippedItems[randomBodySlot];
                const newDura = Math.max(0, (item.durability || 100) - duraLossHit);
                updates[`equippedItems/${randomBodySlot}/durability`] = newDura;
                console.log(`[Durability] Took hit. ${item.name} takes ${duraLossHit} dura damage. New dura: ${newDura}`);
            }
            break;
    }
}


/**
 * [ ⭐️ KONGFA-FIX ⭐️ ] (Bug 2)
 * อัปเกรดระบบ Block/Dodge ใหม่ทั้งหมด + เพิ่มตรรกะความทนทาน
 * แก้ไขการอ่านค่า Damage จาก Hardcoded เป็น `attackData.initialDamage`
 */
async function handlePendingAttack(attackData, playerRef) {
    if (!attackData || !attackData.attackerName || !currentCharacterData) {
        playerRef.child('pendingAttack').remove();
        return;
    }
    const acForDisplay = 10 + getStatBonusFn(calculateTotalStat(currentCharacterData, 'DEX'));

    // ⭐️ [แก้ไข] ดึงค่า Damage ที่ DM ส่งมา (ไม่ใช่ 10)
    const initialDamage = attackData.initialDamage || 10; // (ใช้ 10 เป็นค่าสำรองฉุกเฉิน)

    // --- [FIX] สร้างปุ่ม Block/Dodge/None ---
    const swalOptions = {
        title: `คุณถูกโจมตี!`,
        html: `<strong>${attackData.attackerName}</strong> โจมตีคุณ (ค่าโจมตี: ${attackData.attackRollValue} vs AC คุณ: ${acForDisplay})<br>คุณจะทำอะไร?`,
        icon: 'warning',
        showConfirmButton: false, 
        showCancelButton: false,
        showDenyButton: false,
        timer: 10000, 
        timerProgressBar: true,
        allowOutsideClick: false,
        
        didOpen: (modal) => {
            const actionsContainer = modal.querySelector('.swal2-actions');
            
            // 1. ปุ่ม Dodge (หลบหลีก)
            const dodgeBtn = document.createElement('button');
            dodgeBtn.className = 'swal2-cancel swal2-styled'; // (สีเทาของ Cancel)
            dodgeBtn.innerText = '🏃 หลบ (Dodge)';
            dodgeBtn.onclick = () => Swal.close({ isDismissed: true, dismiss: Swal.DismissReason.cancel }); // (ส่งสัญญาณเหมือนกด Cancel)
            actionsContainer.appendChild(dodgeBtn);
            
            // 2. ปุ่ม Block (ป้องกัน)
            const mainHand = currentCharacterData.equippedItems?.mainHand;
            const offHand = currentCharacterData.equippedItems?.offHand;
            
            // (ต้องมีอาวุธ และความทนทานไม่เป็น 0)
            if (mainHand && (mainHand.durability === undefined || mainHand.durability > 0)) {
                 const mainBtn = document.createElement('button');
                 mainBtn.className = 'swal2-confirm swal2-styled'; // (สีส้ม)
                 mainBtn.innerText = `🛡️ ป้องกัน (มือหลัก: ${mainHand.name})`;
                 mainBtn.onclick = () => Swal.close({ isConfirmed: true, value: 'mainHand' });
                 actionsContainer.appendChild(mainBtn);
            }
            if (offHand && (offHand.durability === undefined || offHand.durability > 0)) {
                 const offBtn = document.createElement('button');
                 offBtn.className = 'swal2-confirm swal2-styled'; // (สีส้ม)
                 offBtn.innerText = `🛡️ ป้องกัน (มือรอง: ${offHand.name})`;
                 offBtn.onclick = () => Swal.close({ isConfirmed: true, value: 'offHand' });
                 actionsContainer.appendChild(offBtn);
            }

            // 3. ปุ่ม ไม่ทำอะไร
            const denyBtn = document.createElement('button');
            denyBtn.className = 'swal2-deny swal2-styled'; // (สีฟ้า)
            denyBtn.innerText = '😑 ไม่ทำอะไร';
            denyBtn.onclick = () => Swal.clickDeny();
            actionsContainer.appendChild(denyBtn);
        }
    };

    Swal.fire(swalOptions).then(async (result) => {
        const snapshot = await playerRef.get();
        const playerData = snapshot.val();
        if (!playerData) return;

        let defenseResponse = { 
            defenderUid: playerRef.key, 
            attackerKey: attackData.attackerKey, 
            attackRollValue: attackData.attackRollValue,
            damageTaken: 0 
        };
        let feedbackTitle = '', feedbackHtml = '';
        
        const roomId = sessionStorage.getItem('roomId');
        const updates = {}; // (สำหรับเก็บการอัปเดตความทนทาน)
        
        // --- 1. ผู้เล่นเลือก "ป้องกัน" (Block) ---
        if (result.isConfirmed) { 
            const weaponSlot = result.value; // 'mainHand' หรือ 'offHand'
            const blockingWeapon = playerData.equippedItems[weaponSlot];
            
            const blockRoll = Math.floor(Math.random() * 20) + 1;
            const totalCon = calculateTotalStat(playerData, 'CON');
            const conBonus = getStatBonusFn(totalCon);
            const totalBlock = blockRoll + conBonus;
            const damageReduction = Math.floor(totalBlock / 3); 

            defenseResponse.choice = 'block';
            defenseResponse.roll = totalBlock;
            defenseResponse.damageReduced = damageReduction;
            
            // ⭐️ [แก้ไข] คำนวณความเสียหายจากค่าที่ DM ส่งมา
            const damageTaken = Math.max(0, initialDamage - damageReduction);
            defenseResponse.damageTaken = damageTaken; 

            if (damageTaken <= 0) {
                // ป้องกันสำเร็จ
                feedbackTitle = '🛡️ ป้องกันสมบูรณ์! 🛡️';
                feedbackHtml = `คุณใช้ ${blockingWeapon.name} ป้องกัน!<br>ทอย (d20+CON) ได้ <strong>${totalBlock}</strong>.<br>ป้องกันความเสียหายได้ <strong>${damageReduction}</strong> หน่วย! (ไม่ได้รับความเสียหาย)`;
                
                applyDurabilityDamage(updates, playerData.equippedItems, 'BLOCK_SUCCESS', {
                    damageReduced: initialDamage, // (ลดตามความเสียหายที่เข้ามา)
                    weaponSlot: weaponSlot
                });
                
            } else {
                // ป้องกันพลาด
                feedbackTitle = '🛡️ ป้องกันพลาด! 🛡️';
                feedbackHtml = `คุณพยายามใช้ ${blockingWeapon.name} ป้องกัน...<br>ทอย (d20+CON) ได้ <strong>${totalBlock}</strong>.<br>ป้องกันได้แค่ <strong>${damageReduction}</strong> หน่วย! รับ <strong>${damageTaken}</strong> หน่วย`;
                
                 applyDurabilityDamage(updates, playerData.equippedItems, 'BLOCK_SUCCESS', {
                    damageReduced: damageReduction, // (ลดตามที่ป้องกันได้)
                    weaponSlot: weaponSlot
                });
                applyDurabilityDamage(updates, playerData.equippedItems, 'BLOCK_FAIL', {
                    damageTaken: damageTaken // (ลดเกราะ ตามที่โดน)
                });
            }

        // --- 2. ผู้เล่นเลือก "หลบหลีก" (Dodge) ---
        } else if (result.isDismissed && result.dismiss === Swal.DismissReason.cancel) { 
            const dodgeRoll = Math.floor(Math.random() * 20) + 1;
            const totalDex = calculateTotalStat(playerData, 'DEX');
            const dexBonus = getStatBonusFn(totalDex);
            const totalDodge = dodgeRoll + dexBonus;
            const isDodgeSuccess = totalDodge > attackData.attackRollValue;

            defenseResponse.choice = 'dodge';
            defenseResponse.roll = totalDodge;
            defenseResponse.success = isDodgeSuccess;
            
            // [FIX] ลดความทนทานรองเท้า 3% (ทุกครั้งที่หลบ)
            applyDurabilityDamage(updates, playerData.equippedItems, 'DODGE', {});

            if (isDodgeSuccess) {
                feedbackTitle = '🏃 หลบหลีกสำเร็จ! 🏃';
                feedbackHtml = `คุณทอยหลบ (d20+DEX) ได้ <strong>${totalDodge}</strong>...<br><strong style="color: #4caf50;">หลบหลีกสำเร็จ!</strong> (ไม่ได้รับความเสียหาย)`;
                defenseResponse.damageTaken = 0;
            } else {
                feedbackTitle = '🏃 หลบหลีกไม่พ้น! 🏃';
                // ⭐️ [แก้ไข] ใช้ค่า damage ที่ถูกต้อง
                feedbackHtml = `คุณทอยหลบได้ <strong>${totalDodge}</strong>...<br><strong style="color: #f44336;">หลบหลีกไม่พ้น!</strong> รับ <strong>${initialDamage}</strong> หน่วย`;
                defenseResponse.damageTaken = initialDamage;
                
                 applyDurabilityDamage(updates, playerData.equippedItems, 'BLOCK_FAIL', { // (ใช้ตรรกะเดียวกับ Block Fail)
                    damageTaken: initialDamage
                });
            }

        // --- 3. ผู้เล่น "ไม่ทำอะไร" หรือ "หมดเวลา" ---
        } else { 
            defenseResponse.choice = 'none';
            feedbackTitle = '😑 โดนโจมตีเต็มๆ! 😑';
            feedbackHtml = (result.dismiss === Swal.DismissReason.timer) ? 'หมดเวลา! คุณไม่ป้องกัน!' : 'คุณเลือกที่จะไม่ป้องกัน';
            // ⭐️ [แก้ไข] ใช้ค่า damage ที่ถูกต้อง
            feedbackHtml += `<br>รับความเสียหาย <strong>${initialDamage}</strong> หน่วย`;
            defenseResponse.damageTaken = initialDamage;
            
             applyDurabilityDamage(updates, playerData.equippedItems, 'TAKE_HIT', {
                damageTaken: initialDamage
            });
        }

        Swal.fire({ title: feedbackTitle, html: feedbackHtml, icon: 'info', timer: 3500 });
        
        // ส่งผลลัพธ์กลับไปให้ DM (DM จะเป็นคนลด HP)
        await db.ref(`rooms/${roomId}/combat/resolution`).set(defenseResponse);
        
        // อัปเดตความทนทาน (ถ้ามี)
        if (Object.keys(updates).length > 0) {
            await playerRef.update(updates);
        }
        
        await playerRef.child('pendingAttack').remove();
    });
}


// =================================================================
// ส่วนที่ 4: Initializer & Real-time Listener
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================

firebase.auth().onAuthStateChanged(user => {
    if (user) {
        let isInitialLoadComplete = false;
        const currentUserUid = user.uid;
        localStorage.setItem('currentUserUid', currentUserUid); 
        const roomId = sessionStorage.getItem('roomId');
        if (!roomId) { window.location.replace('lobby.html'); return; }

        if (!isInitialLoadComplete) showLoading('กำลังโหลดข้อมูลตัวละคร (v3)...');
        
        injectDashboardStyles();

        const playerRef = db.ref(`rooms/${roomId}/playersByUid/${currentUserUid}`);

        db.ref(`rooms/${roomId}`).on('value', snapshot => {
            const roomData = snapshot.val() || {};
            
            allPlayersInRoom = roomData.playersByUid || {};
            allEnemiesInRoom = roomData.enemies || {};
            combatState = roomData.combat || {};
            currentCharacterData = allPlayersInRoom[currentUserUid]; 
            if (currentCharacterData) currentCharacterData.uid = currentUserUid; 

            if (currentCharacterData) {
                displayCharacter(currentCharacterData, combatState);
                displayInventory(currentCharacterData.inventory);
                displayEquippedItems(currentCharacterData.equippedItems);
                displayQuest(currentCharacterData.quest);
                displayTeammates(currentUserUid); 
                displayEnemies(allEnemiesInRoom, currentUserUid);
                updateTurnDisplay(combatState, currentUserUid);
                displayStory(roomData.story);

                if (!isInitialLoadComplete) {
                    hideLoading();
                    isInitialLoadComplete = true;
                }

            } else if (isInitialLoadComplete) {
                 document.getElementById("characterInfoPanel").innerHTML = `<h2>สร้างตัวละคร</h2><p>คุณยังไม่มีตัวละครในห้องนี้</p><a href="PlayerCharecter.html"><button style="width:100%;">สร้างตัวละครใหม่</button></a>`;
                 if (Swal.isVisible() && Swal.isLoading()) hideLoading();

            } else {
                hideLoading();
                document.getElementById("characterInfoPanel").innerHTML = `<h2>สร้างตัวละคร</h2><p>คุณยังไม่มีตัวละครในห้องนี้</p><a href="PlayerCharecter.html"><button style="width:100%;">สร้างตัวละครใหม่</button></a>`;
                isInitialLoadComplete = true;
            }
        });

        // Listener สำหรับการโจมตี (ข้อ 7)
        playerRef.child('pendingAttack').on('value', s => {
            if (s.exists() && !Swal.isVisible() && combatState && combatState.isActive) {
                 handlePendingAttack(s.val(), playerRef);
            } else if (!s.exists() && Swal.isVisible() && Swal.getTitle() === 'คุณถูกโจมตี!') {
                Swal.close();
            }
        });

    } else {
        window.location.replace('login.html');
    }
});