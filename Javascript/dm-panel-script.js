/*
* =================================================================
* Javascript/dm-panel-script.js (v3.2 - KONGFA FIX)
* -----------------------------------------------------------------
* นี่คือ "สมอง" ของ DM (ข้อ 6)
*
* [ ⭐️ KONGFA-FIX 1 (REVISED) ⭐️ ]
* - แก้ไขบั๊ก "กดจบการต่อสู้" ไม่ได้ (Bug 3)
* - เปลี่ยนฟังก์ชัน `endCombat()` ให้ล้าง activeEffects และ
* skillCooldowns ของผู้เล่นทุกคน (allPlayersDataByUID)
* พร้อมกับการล้าง /combat node
*
* [ ⭐️ KONGFA-FIX 2 ⭐️ ]
* - แก้ไขบั๊ก "เทิร์นศัตรูค้าง"
* - แก้ไข `listenForActionComplete` ให้รับสัญญาณจาก Enemy ได้
* =================================================================
*/

// --- Global State ---
let allPlayersDataByUID = {};
let allEnemies = {};
let combatState = {};
// (v3) ดึงข้อมูลจาก skills-data.js
const ALL_CLASSES = (typeof CLASS_DATA !== 'undefined') ? Object.keys(CLASS_DATA) : [];
const ALL_RACES = (typeof RACE_DATA !== 'undefined') ? Object.keys(RACE_DATA) : [];
const ALL_WEAPON_TYPES = (typeof CLASS_WEAPON_PROFICIENCY !== 'undefined') ? 
    [...new Set(Object.values(CLASS_WEAPON_PROFICIENCY).flat())] : 
    ['ดาบ', 'ขวาน', 'ดาบใหญ่', 'หอก', 'มีด', 'ธนู', 'หน้าไม้', 'ดาบสั้น', 'อาวุธซัด', 'คทา', 'ไม้เท้า', 'หนังสือเวท', 'ค้อน', 'กระบอง', 'โล่', 'อาวุธทื่อ'];

// =================================================================================
// ส่วนที่ 1: Utility & Calculation Functions (REBUILT v3)
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

// (Helper functions: showCustomAlert, getStatBonusFn)
function showCustomAlert(message, iconType = 'info') {
    // (ใช้ ui-helpers.js ที่โหลดมาแล้ว)
    if (typeof showCustomAlert_UI === 'function') {
        return showCustomAlert_UI(message, iconType);
    }
    // (Fallback เผื่อ ui-helpers.js โหลดไม่ทัน)
    const buttonColor = iconType === 'error' ? '#dc3545' : '#28a745';
    Swal.fire({
        title: iconType === 'success' ? 'สำเร็จ!' : iconType === 'error' ? 'ข้อผิดพลาด!' : '⚠️ แจ้งเตือน!',
        text: message,
        icon: iconType,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: buttonColor
    });
}

function getStatBonusFn(statValue) {
    const value = Number(statValue);
    const validValue = isNaN(value) ? 10 : value;
    return Math.floor((validValue - 10) / 2);
}

/**
 * [อัปเกรด v3.1] คำนวณสเตตัสรวม (Final Stat)
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
    
    // 5. [v3] คำนวณโบนัสจากออร่า (DM ไม่ต้องคำนวณ)

    // 6. คำนวณโบนัสจากอุปกรณ์ (Equipped Items)
    let equipBonus = 0;
    if (charData.equippedItems) {
        for (const slot in charData.equippedItems) {
            const item = charData.equippedItems[slot];
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

/**
 * [อัปเกรด v3] คำนวณ HP (ใช้ตรรกะเดียวกับ charector.js v3)
 */
function calculateHP(charRace, charClass, finalCon) {
    // (โหลดจาก charector.js)
    if (typeof calculateHP_CORE === 'function') {
        return calculateHP_CORE(charRace, charClass, finalCon);
    }
    // (Fallback เผื่อพลาด)
    console.warn("calculateHP_CORE not found, using fallback calculation.");
    const race = (typeof RACE_DATA !== 'undefined') ? RACE_DATA[charRace] : null;
    let raceHP = 10;
    if (race && race.bonuses && race.bonuses.CON) raceHP += (race.bonuses.CON * 2); 
    const classBaseHP = { 'แทงค์': 20, 'นักรบ': 15, 'นักเวท': 8, 'นักบวช': 10, 'โจร': 12, 'เรนเจอร์': 12, 'พ่อค้า': 10 };
    let classHP = classBaseHP[charClass] || 10;
    const conModifier = getStatBonusFn(finalCon);
    let totalHP = (raceHP + classHP) + (conModifier * 2);
    if (charRace === 'โกเลม') totalHP *= 1.25;
    return Math.floor(Math.max(1, totalHP));
}

function calculateDamage(damageDice, strBonus) {
    const diceType = parseInt((damageDice || 'd6').replace('d', ''));
    if (isNaN(diceType) || diceType < 1) return 1;
    const damageRoll = Math.floor(Math.random() * diceType) + 1;
    return Math.max(1, damageRoll + strBonus);
}

function getExpForNextLevel(level) {
    return Math.floor(300 * Math.pow(1.8, level - 1));
}

// =================================================================================
// ส่วนที่ 2: Display Functions (ฟังก์ชันแสดงผล UI)
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

function getUidByName(playerName) {
    for (const uid in allPlayersDataByUID) {
        if (allPlayersDataByUID[uid].name === playerName) {
            return uid;
        }
    }
    return null;
}

function resetPlayerEditor() {
    document.getElementById("playerEditor").querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'number') el.value = 0;
        else if (el.tagName === 'SELECT') el.selectedIndex = 0;
        else el.value = '';
    });
    document.getElementById("editName").value = '';
    document.getElementById("editLevel").textContent = 'N/A';
    document.getElementById("editFreeStatPoints").textContent = 'N/A';
    displayPlayerSummary(null);
}

function loadPlayer() {
    const selectedPlayerName = document.getElementById("playerSelect").value;
    const uid = getUidByName(selectedPlayerName);
    const player = allPlayersDataByUID[uid];

    if (!selectedPlayerName || !player) {
        resetPlayerEditor();
        return;
    }

    document.getElementById("editName").value = player.name;
    document.getElementById("editRace").value = player.race || "มนุษย์";
    document.getElementById("editRaceEvolved").value = player.raceEvolved || ""; 
    document.getElementById("editGender").value = player.gender || "ไม่ระบุ";
    document.getElementById("editAge").value = player.info?.age || ""; 
    document.getElementById("editClassMain").value = player.classMain || "นักรบ"; 
    document.getElementById("editClassSub").value = player.classSub || ""; 
    document.getElementById("editBackground").value = player.background || "";
    document.getElementById("editGP").value = player.gp || 0; 

    document.getElementById("editHeight").value = player.info?.height || "";
    document.getElementById("editWeight").value = player.info?.weight || "";
    document.getElementById("editAppearance").value = player.info?.appearance || "";
    document.getElementById("editPersonality").value = player.info?.personality || "";
    document.getElementById("editLikes").value = player.info?.likes || "";
    document.getElementById("editDislikes").value = player.info?.dislikes || "";
    
    document.getElementById("editHp").value = player.hp;
    document.getElementById("editLevel").textContent = player.level || 1;
    document.getElementById("editFreeStatPoints").textContent = player.freeStatPoints || 0;
    
    let tempLevel = 0;
    if (Array.isArray(player.activeEffects)) {
         player.activeEffects.forEach(effect => {
             if (effect.stat === 'Level' && effect.modType === 'FLAT') {
                 tempLevel += (effect.amount || 0);
             }
         });
    }
    document.getElementById("tempLevelInput").value = tempLevel;

    const statsKeys = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const classMainData = (typeof CLASS_DATA !== 'undefined') ? CLASS_DATA[player.classMain] : null;
    const classSubData = (typeof CLASS_DATA !== 'undefined') ? CLASS_DATA[player.classSub] : null;
            
    statsKeys.forEach(stat => {
        document.getElementById(`edit${stat}Race`).value = player.stats ?.baseRaceStats ?.[stat] || 0;
        
        let classBonus = 0;
        if (classMainData && classMainData.bonuses) classBonus += (classMainData.bonuses[stat] || 0);
        if (classSubData && classSubData.bonuses) classBonus += (classSubData.bonuses[stat] || 0);
        document.getElementById(`edit${stat}Class`).value = classBonus; 
        
        document.getElementById(`edit${stat}Invested`).value = player.stats ?.investedStats ?.[stat] || 0;
        document.getElementById(`edit${stat}Temp`).value = player.stats ?.tempStats ?.[stat] || 0;
        updateStatTotals(stat); 
    });

    displayPlayerSummary(player); 
    loadItemLists(player);
}

function updateStatTotals(statKey) {
    const name = document.getElementById("playerSelect").value;
    const uid = getUidByName(name);
    if (!uid || !allPlayersDataByUID[uid]) return;

    const tempPlayer = JSON.parse(JSON.stringify(allPlayersDataByUID[uid]));
    const tempValue = parseInt(document.getElementById(`edit${statKey}Temp`).value) || 0;

    if (!tempPlayer.stats) tempPlayer.stats = {};
    if (!tempPlayer.stats.tempStats) tempPlayer.stats.tempStats = {};
    tempPlayer.stats.tempStats[statKey] = tempValue;
    
    document.getElementById(`edit${statKey}Total`).value = calculateTotalStat(tempPlayer, statKey);
}

function displayPlayerSummary(player) {
    const output = document.getElementById("playerSummaryPanel");
    if (!output) return;

    if (!player) {
        output.innerHTML = "<h3>สรุปข้อมูลตัวละคร</h3><p>โปรดเลือกผู้เล่นเพื่อดูสรุปข้อมูล</p>";
        return;
    }

    const finalCon = calculateTotalStat(player, 'CON');
    const maxHpNew = player.maxHp || calculateHP(player.race, player.classMain, finalCon);
    let currentHp = player.hp;
    if (currentHp > maxHpNew) currentHp = maxHpNew;

    let htmlContent = `<h3>สรุปข้อมูลตัวละคร: ${player.name}</h3><hr>`;
    htmlContent += `<p><strong>เผ่า:</strong> ${player.raceEvolved || player.race}</p>`;
    htmlContent += `<p><strong>อาชีพหลัก:</strong> ${player.classMain}</p>`;
    htmlContent += `<p><strong>อาชีพรอง:</strong> ${player.classSub || '-'}</p><hr>`;
    
    const permanentLevel = player.level || 1;
    let tempLevel = 0;
    if (Array.isArray(player.activeEffects)) {
         player.activeEffects.forEach(effect => {
             if (effect.stat === 'Level' && effect.modType === 'FLAT') {
                 tempLevel += (effect.amount || 0);
             }
         });
    }
    if (tempLevel > 0) {
        htmlContent += `<p><strong>ระดับ (Level):</strong> ${permanentLevel} <span style="color: #00ff00;">(+${tempLevel})</span></p>`;
    } else {
        htmlContent += `<p><strong>ระดับ (Level):</strong> ${permanentLevel}</p>`;
    }
    
    htmlContent += `<p><strong>EXP:</strong> ${player.exp || 0} / ${player.expToNextLevel || 300}</p>`;
    htmlContent += `<p><strong>GP:</strong> ${player.gp || 0}</p><hr>`;
    htmlContent += `<p><strong>HP:</strong> ${currentHp} / ${maxHpNew}</p>`;
    
    for (const stat of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
        htmlContent += `<p><strong>${stat}:</strong> ${calculateTotalStat(player, stat)}</p>`;
    }
    
    const effects = player.activeEffects || [];
    if(effects.length > 0) {
        htmlContent += `<hr><h4>Active Effects:</h4><ul>`;
        effects.forEach(effect => {
             const modText = effect.modType === 'PERCENT' ? `${effect.amount}%` : `${effect.amount}`;
             htmlContent += `<li>${effect.name}: ${effect.stat} ${modText} (${effect.turnsLeft} เทิร์น)</li>`;
        });
        htmlContent += `</ul>`;
    }

    if (player.quest && player.quest.title) {
        htmlContent += `<div style="border: 1px solid #ffc107; padding: 10px; margin-top: 15px; border-radius: 5px; background-color: #ffc1071a;">
                                <h4>📜 เควสปัจจุบัน: ${player.quest.title}</h4>
                                <p style="font-size: small;"><strong>รายละเอียด:</strong> ${player.quest.detail || '-'}</p>
                                <p style="font-size: small;"><strong>รางวัล:</strong> ${player.quest.reward || '-'}</p>
                                <p style="font-size: small;"><strong>รางวัล EXP:</strong> ${player.quest.expReward || 0}</p>
                                <button onclick="completeQuest()" style="background-color: #28a745; width: 49%;">🏆 สำเร็จเควส</button>
                                <button onclick="cancelQuest()" style="background-color: #dc3545; width: 49%; margin-left: 2%;">❌ ยกเลิกเควส</button>
                            </div>`;
    } else {
        htmlContent += `<p style="margin-top: 10px; color: #777;"><em>ผู้เล่นนี้ยังไม่มีเควส</em></p>`;
    }
    output.innerHTML = htmlContent;
}

function loadItemLists(player) {
    const items = player ?.inventory || [];
    const itemSelect = document.getElementById("itemSelect");
    itemSelect.innerHTML = "";
    if (items.length === 0) {
        itemSelect.innerHTML = "<option disabled>ไม่มีไอเทม</option>";
        return;
    }
    items.forEach((item, index) => {
        const option = `<option value="${index}">${item.name} (x${item.quantity})</option>`;
        itemSelect.innerHTML += option;
    });
}
function displayDiceLog(logs, logElementId) {
    const logList = document.getElementById(logElementId);
    logList.innerHTML = `<li>ไม่มีบันทึก</li>`;
    if (!logs) return;
    const logArray = Object.values(logs).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (logArray.length > 0) logList.innerHTML = "";
    logArray.slice(0, 15).forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString('th-TH');
        let message = `[${time}] ${log.name}: ${log.message}`;
        if (log.type === 'general' || !log.type) {
            const total = log.result.reduce((a, b) => a + b, 0);
            message = `[${time}] ${log.name} ทอย ${log.count}d${log.dice}: [${log.result.join(', ')}] รวม: ${total}`;
        }
        const color = log.type === 'damage' ? '#ff4d4d' : (log.type === 'attack' ? '#17a2b8' : '#fff');
        logList.innerHTML += `<li style="color:${color};">${message}</li>`;
    });
}
function displayAllEnemies(enemies) {
    const container = document.getElementById('enemyListContainer');
    container.innerHTML = '';
    if (!enemies || Object.keys(enemies).length === 0) {
        container.innerHTML = '<p>ยังไม่มีคู่ต่อสู้ในฉากนี้</p>';
        return;
    }
    for (const key in enemies) {
        const enemy = enemies[key];
        const target = allPlayersDataByUID[enemy.targetUid] ? allPlayersDataByUID[enemy.targetUid].name : '<i>(ศัตรูร่วม)</i>';
        const enemyDiv = document.createElement('div');
        enemyDiv.className = 'enemy-list-item';
        enemyDiv.innerHTML = `
            <strong>${enemy.name}</strong> (HP: ${enemy.hp} / ${enemy.maxHp || '??'})<br>
            <small>เป้าหมาย: ${target}</small> | <small>EXP: ${enemy.expValue || 0}</small>
            <div style="float: right;">
                <button onclick="moveEnemy('${key}')" style="background-color:#fd7e14;">ย้าย</button>
                <button onclick="deleteEnemy('${key}')" style="background-color:#c82333;">ลบ</button>
            </div>
        `;
        container.appendChild(enemyDiv);
    }
}

// =================================================================================
// ส่วนที่ 3: Combat Functions (REBUILT v3) (ข้อ 7)
// =================================================================================

async function advanceTurn() {
    const roomId = sessionStorage.getItem('roomId');
    const combatRef = db.ref(`rooms/${roomId}/combat`);

    const snapshot = await combatRef.get();
    const currentCombatState = snapshot.val() || {};
    if (!currentCombatState.isActive) return;

    let nextIndex = (currentCombatState.currentTurnIndex + 1) % currentCombatState.turnOrder.length;
    const maxSkips = currentCombatState.turnOrder.length;
    let skips = 0;

    // --- 1. ข้ามยูนิตที่ตายแล้ว ---
    while (skips < maxSkips) {
        const nextUnit = currentCombatState.turnOrder[nextIndex];
        let isDead = false;

        if (nextUnit.type === 'player') {
            isDead = (allPlayersDataByUID[nextUnit.id]?.hp || 0) <= 0;
        } else if (nextUnit.type === 'enemy') {
            isDead = (allEnemies[nextUnit.id]?.hp || 0) <= 0;
        }

        if (isDead) {
            console.log(`Skipping turn for dead unit: ${nextUnit.name}`);
            nextIndex = (nextIndex + 1) % currentCombatState.turnOrder.length;
            skips++;
        } else break;
    }

    if (skips === maxSkips) {
        endCombat(); // ทุกคนตายหมด
        return;
    }

    // --- 2. [อัปเกรด v3] นับคูลดาวน์ (Personal Round) (ข้อ 7) ---
    const nextUnit = currentCombatState.turnOrder[nextIndex];
    let unitRef;

    if (nextUnit.type === 'player') {
        unitRef = db.ref(`rooms/${roomId}/playersByUid/${nextUnit.id}`);
    } else { // 'enemy'
        unitRef = db.ref(`rooms/${roomId}/enemies/${nextUnit.id}`);
    }

    if (unitRef) {
        await unitRef.transaction(unitData => {
            if (!unitData) return unitData; 

            // 2.1 ลดค่า turnsLeft ของ Buffs/Debuffs (activeEffects)
            if (Array.isArray(unitData.activeEffects)) {
                unitData.activeEffects.forEach(effect => {
                    if (effect.turnsLeft > 0) {
                        effect.turnsLeft--;
                    }
                });
                unitData.activeEffects = unitData.activeEffects.filter(effect => effect.turnsLeft > 0);
            }
            
            // 2.2 ลดค่า turnsLeft ของ Skill Cooldowns (skillCooldowns)
            if (unitData.skillCooldowns) {
                for (const skillId in unitData.skillCooldowns) {
                    const cd = unitData.skillCooldowns[skillId];
                    if (cd && cd.type === 'PERSONAL' && cd.turnsLeft > 0) {
                        cd.turnsLeft--; 
                        if (cd.turnsLeft === 0) {
                            unitData.skillCooldowns[skillId] = null; // ล้าง CD เมื่อหมด
                        }
                    }
                }
            }
            return unitData; // ส่งข้อมูลกลับ
        });
        console.log(`[Personal Round] อัปเดตเอฟเฟกต์/คูลดาวน์สำหรับ ${nextUnit.name}`);
    }
    
    // --- 3. อัปเดตเทิร์น ---
    await combatRef.child('currentTurnIndex').set(nextIndex);
    await combatRef.child('lastUpdated').set(Date.now());

    const display = document.getElementById('dm-roll-result-display');
    if (display) display.innerHTML = 'รอการดำเนินการ...';

    console.log(`เทิร์นต่อไป: ${currentCombatState.turnOrder[nextIndex].name}`);
}

/**
 * [ ⭐️ KONGFA-FIX 1 (REVISED) ⭐️ ]
 * [อัปเกรด v3] จบการต่อสู้ (ข้อ 7: รีเซ็ต Cooldown)
 * [แก้ไข Bug 3] เพิ่มการล้าง Buffs/Cooldowns ของผู้เล่น
 */
async function endCombat() {
    const roomId = sessionStorage.getItem('roomId');
    if (!roomId) return;

    showLoading("กำลังจบการต่อสู้...");

    try {
        // [FIX] สร้าง object 'updates' เพื่อรวบรวมการเปลี่ยนแปลงทั้งหมด
        const updates = {};

        // 1. ลบ /combat node ทิ้ง
        updates[`rooms/${roomId}/combat`] = null;
        
        // 2. รีเซ็ตคูลดาวน์ของศัตรู
        Object.keys(allEnemies).forEach(key => {
            updates[`rooms/${roomId}/enemies/${key}/activeEffects`] = [];
            updates[`rooms/${roomId}/enemies/${key}/skillCooldowns`] = {};
        });

        // 3. [ ⭐️ KONGFA-FIX (Bug 3) ⭐️ ]
        // รีเซ็ต Buffs/Cooldowns ของผู้เล่นทุกคน
        // (allPlayersDataByUID ถูกโหลดมาโดย listener อยู่แล้ว)
        Object.keys(allPlayersDataByUID).forEach(uid => {
            updates[`rooms/${roomId}/playersByUid/${uid}/activeEffects`] = [];
            updates[`rooms/${roomId}/playersByUid/${uid}/skillCooldowns`] = {};
        });

        // 4. สั่ง update ทั้งหมดในครั้งเดียว
        await db.ref().update(updates);

        hideLoading();
        showCustomAlert('การต่อสู้จบลงแล้ว', 'info');
        
    } catch (error) {
        hideLoading();
        console.error("Error ending combat:", error);
        showCustomAlert('เกิดข้อผิดพลาดในการจบการต่อสู้', 'error');
    }
}


async function dmPerformEnemyAttack() {
    const roomId = sessionStorage.getItem('roomId');
    const display = document.getElementById('dm-roll-result-display');
    const attackButton = document.getElementById('enemy-attack-button');
    attackButton.disabled = true;
    display.innerHTML = 'กำลังทอยเต๋าโจมตี...';

    const attackerUnit = combatState.turnOrder[combatState.currentTurnIndex];
    const attackerData = allEnemies[attackerUnit.id];
    const targetPlayerUid = document.getElementById('enemy-attack-target-select').value;
    const targetPlayerData = allPlayersDataByUID[targetPlayerUid];

    if (!attackerData || !targetPlayerData) {
        showCustomAlert('ไม่พบข้อมูลผู้โจมตีหรือเป้าหมาย!', 'error');
        attackButton.disabled = false;
        return;
    }

    const rollResult = Math.floor(Math.random() * 20) + 1;
    const strBonus = Math.floor(((attackerData.stats.STR || 10) - 10) / 2);
    const totalAttack = rollResult + strBonus;

    const playerDEX = calculateTotalStat(targetPlayerData, 'DEX');
    const playerAC = 10 + Math.floor((playerDEX - 10) / 2);
    
    // [ ⭐️ KONGFA-FIX ⭐️ ]
    // คำนวณ Damage ที่นี่ และส่งไปให้ผู้เล่นเลย
    const damageDice = attackerData.damageDice || 'd6';
    const initialDamage = calculateDamage(damageDice, strBonus);

    const pendingAttack = {
        attackerKey: attackerUnit.id,
        attackerName: attackerData.name,
        attackRollValue: totalAttack,
        targetAC: playerAC,
        initialDamage: initialDamage // [FIX] ส่งค่า Damage ไปด้วย
    };

    if (totalAttack < playerAC) {
        display.innerHTML = `<p style="color: #ff4d4d;"><strong>${attackerData.name}</strong> โจมตี <strong>${targetPlayerData.name}</strong> พลาด!</p><p>ค่าโจมตี: ${totalAttack} (ทอย ${rollResult} + โบนัส ${strBonus}) vs AC ผู้เล่น: ${playerAC}</p>`;
        attackButton.disabled = false;
        setTimeout(async () => {
             await db.ref(`rooms/${roomId}/combat/actionComplete`).set(attackerUnit.id);
        }, 1500);
        return;
    }

    await db.ref(`rooms/${roomId}/playersByUid/${targetPlayerUid}/pendingAttack`).set(pendingAttack);

    display.innerHTML = `<p><strong>${attackerData.name}</strong> โจมตี <strong>${targetPlayerData.name}</strong>!</p><p>ค่าโจมตี: ${totalAttack} (ทอย ${rollResult} + โบนัส ${strBonus}) vs AC ผู้เล่น: ${playerAC}</p><p style="color: #ffc107;">...กำลังรอการตอบสนองจากผู้เล่น (10 วินาที)...</p>`;
}

async function handleDefenseResolution(resolution) {
    if (!resolution || Swal.isVisible()) return;

    const roomId = sessionStorage.getItem('roomId');
    const display = document.getElementById('dm-roll-result-display');
    const attackerUnit = combatState.turnOrder[combatState.currentTurnIndex];

    const defenderData = allPlayersDataByUID[resolution.defenderUid];
    const attackerData = allEnemies[resolution.attackerKey];
    if (!defenderData || !attackerData) return;
    
    // [ ⭐️ KONGFA-FIX ⭐️ ]
    // อ่านค่า damageTaken ที่ผู้เล่นคำนวณมา (ซึ่งรวมค่าลด Passive แล้ว)
    const finalDamage = resolution.damageTaken || 0;
    
    let finalHtml = display.innerHTML.replace('<p style="color: #ffc107;">...กำลังรอการตอบสนองจากผู้เล่น (10 วินาที)...</p>', '');

    // (แสดงผลตามที่ผู้เล่นส่งมา)
    switch (resolution.choice) {
        case 'dodge':
            if (resolution.success) {
                finalHtml += `<p style="color: #00ff00;">🏃 <strong>${defenderData.name} หลบได้สำเร็จ!</strong> (ทอย ${resolution.roll})</p>`;
            } else {
                finalHtml += `<p style="color: #ff4d4d;">🏃 <strong>${defenderData.name} หลบไม่พ้น!</strong> (ทอย ${resolution.roll})</p>`;
            }
            break;
        case 'block':
            finalHtml += `<p style="color: #17a2b8;">🛡️ <strong>${defenderData.name} ป้องกัน!</strong> (ทอย ${resolution.roll})</p><p>ลดความเสียหาย ${resolution.damageReduced} หน่วย</p>`;
            break;
        case 'none':
            finalHtml += `<p style="color: #aaa;">😑 <strong>${defenderData.name} ไม่ป้องกัน!</strong></p>`;
            break;
    }
    
    finalHtml += `<p><strong>รับความเสียหายสุดท้าย ${finalDamage} หน่วย!</strong></p>`;

    // [ ⭐️ KONGFA-FIX ⭐️ ]
    // DM ทำการลด HP ของผู้เล่น
    const newHp = Math.max(0, defenderData.hp - finalDamage);
    await db.ref(`rooms/${roomId}/playersByUid/${resolution.defenderUid}/hp`).set(newHp);

    display.innerHTML = finalHtml;
    await db.ref(`rooms/${roomId}/combat/resolution`).remove();

    setTimeout(async () => {
        await db.ref(`rooms/${roomId}/combat/actionComplete`).set(attackerUnit.id);
    }, 3000);
}

function displayCombatState(state) {
    const inactiveView = document.getElementById('combat-inactive-view');
    const activeView = document.getElementById('combat-active-view');
    const turnOrderList = document.getElementById('turnOrderDisplay');
    const currentTurnActionPanel = document.getElementById('current-turn-action-panel');
    const playerTurnView = document.getElementById('player-turn-view');
    const enemyTurnView = document.getElementById('enemy-turn-view');
    const currentTurnUnitName = document.getElementById('current-turn-unit-name');
    const enemyAttackTargetSelect = document.getElementById('enemy-attack-target-select');

    if (!state || !state.isActive) {
        inactiveView.classList.remove('hidden');
        activeView.classList.add('hidden');
        currentTurnActionPanel.classList.add('hidden');
        return;
    }

    inactiveView.classList.add('hidden');
    activeView.classList.remove('hidden');
    currentTurnActionPanel.classList.remove('hidden');

    turnOrderList.innerHTML = '';
    state.turnOrder.forEach((unit, index) => {
        const li = document.createElement('li');
        li.textContent = `${unit.name} (DEX: ${unit.dex})`;
        if (index === state.currentTurnIndex) {
            li.className = 'current-turn';
        }
        turnOrderList.appendChild(li);
    });

    const currentUnit = state.turnOrder[state.currentTurnIndex];
    currentTurnUnitName.textContent = `เทิร์นของ: ${currentUnit.name}`;

    if (currentUnit.type === 'player') {
        playerTurnView.classList.remove('hidden');
        enemyTurnView.classList.add('hidden');
    } else { 
        playerTurnView.classList.add('hidden');
        enemyTurnView.classList.remove('hidden');

        const currentEnemyData = allEnemies[currentUnit.id];
        const tauntEffect = Array.isArray(currentEnemyData?.activeEffects)
            ? currentEnemyData.activeEffects.find(effect => effect.type === 'TAUNT')
            : null;

        if (tauntEffect && allPlayersDataByUID[tauntEffect.taunterUid]?.hp > 0) {
            const taunter = allPlayersDataByUID[tauntEffect.taunterUid];
            currentTurnUnitName.textContent = `เทิร์นของ: ${currentUnit.name} (ถูกยั่วยุโดย ${taunter.name}!)`;
            enemyAttackTargetSelect.innerHTML = `<option value="${tauntEffect.taunterUid}">${taunter.name} (HP: ${taunter.hp})</option>`;
            enemyAttackTargetSelect.disabled = true;

        } else {
            enemyAttackTargetSelect.disabled = false;
            enemyAttackTargetSelect.innerHTML = '';
            for (const uid in allPlayersDataByUID) {
                if ((allPlayersDataByUID[uid].hp || 0) > 0) {
                    enemyAttackTargetSelect.innerHTML += `<option value="${uid}">${allPlayersDataByUID[uid].name} (HP: ${allPlayersDataByUID[uid].hp})</option>`;
                }
            }
            if (currentEnemyData && currentEnemyData.targetUid && allPlayersDataByUID[currentEnemyData.targetUid]) {
                enemyAttackTargetSelect.value = currentEnemyData.targetUid;
            } else if (enemyAttackTargetSelect.options.length > 0) {
                enemyAttackTargetSelect.selectedIndex = 0;
            }
        }
    }
    document.getElementById('enemy-attack-button').disabled = (currentUnit.type === 'player');
}

async function startCombat() {
    const roomId = sessionStorage.getItem('roomId');
    if (!roomId) return;

    // [ ⭐️ KONGFA-FIX ⭐️ ] รีเซ็ตคูลดาวน์ผู้เล่น
    const playerUpdates = {};
    for (const uid in allPlayersDataByUID) {
        playerUpdates[`/rooms/${roomId}/playersByUid/${uid}/skillCooldowns`] = {};
        playerUpdates[`/rooms/${roomId}/playersByUid/${uid}/activeEffects`] = [];
    }
    await db.ref().update(playerUpdates);
    console.log("รีเซ็ต Cooldown/Effects ของผู้เล่นทุกคนแล้ว");

    const units = [];
    for (const uid in allPlayersDataByUID) {
        const player = allPlayersDataByUID[uid];
        if ((player.hp || 0) > 0) {
            units.push({
                id: uid,
                name: player.name,
                dex: calculateTotalStat(player, 'DEX'), 
                type: 'player'
            });
        }
    }
    for (const key in allEnemies) {
        const enemy = allEnemies[key];
        if ((enemy.hp || 0) > 0) {
            units.push({
                id: key,
                name: enemy.name,
                dex: enemy.stats ?.DEX || 10,
                type: 'enemy'
            });
        }
    }

    if (units.length < 2) {
        showCustomAlert('ต้องมีผู้เข้าร่วมต่อสู้อย่างน้อย 2 ฝ่าย!', 'warning');
        return;
    }

    units.sort((a, b) => b.dex - a.dex);

    const initialCombatState = {
        isActive: true,
        turnOrder: units,
        currentTurnIndex: 0
    };

    db.ref(`rooms/${roomId}/combat`).set(initialCombatState)
        .then(() => showCustomAlert('เริ่มการต่อสู้!', 'success'));
}

function forceAdvanceTurn() {
    Swal.fire({
        title: 'บังคับข้ามเทิร์น?',
        text: "คุณต้องการข้ามเทิร์นของผู้เล่นคนนี้ใช่หรือไม่?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ข้ามเลย'
    }).then((result) => {
        if (result.isConfirmed) {
            const roomId = sessionStorage.getItem('roomId');
            const currentUnit = combatState.turnOrder[combatState.currentTurnIndex];
            db.ref(`rooms/${roomId}/combat/actionComplete`).set(currentUnit.id);
        }
    });
}


// =================================================================================
// ส่วนที่ 4: Write Functions (Player Management)
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

async function saveBasicInfo() {
    const roomId = sessionStorage.getItem('roomId');
    const name = document.getElementById("playerSelect").value;
    const uid = getUidByName(name);
    if (!roomId || !uid) return;
    
    const currentPlayer = allPlayersDataByUID[uid];
    const newClassMain = document.getElementById("editClassMain").value;
    const newClassSub = document.getElementById("editClassSub").value || null; 
    const newRaceName = document.getElementById("editRace").value;
    const newRaceEvolved = document.getElementById("editRaceEvolved").value || null; 

    const updates = {
        hp: parseInt(document.getElementById("editHp").value),
        gp: parseInt(document.getElementById("editGP").value) || 0,
        gender: document.getElementById("editGender").value,
        background: document.getElementById("editBackground").value,
        
        classMain: newClassMain,
        classSub: newClassSub,
        race: newRaceName,
        raceEvolved: newRaceEvolved,
        
        info: {
            age: parseInt(document.getElementById("editAge").value) || 1,
            height: document.getElementById("editHeight").value || "",
            weight: document.getElementById("editWeight").value || "",
            appearance: document.getElementById("editAppearance").value || "",
            personality: document.getElementById("editPersonality").value || "",
            likes: document.getElementById("editLikes").value || "",
            dislikes: document.getElementById("editDislikes").value || ""
        }
    };

    const classChanged = newClassMain !== currentPlayer.classMain;
    const raceChanged = newRaceName !== currentPlayer.race;
    
    if (classChanged || raceChanged) {
        const newRaceStats = (typeof RACE_DATA !== 'undefined') ? (RACE_DATA[newRaceName]?.bonuses || {}) : {};
        const newClassStats = (typeof CLASS_DATA !== 'undefined') ? (CLASS_DATA[newClassMain]?.bonuses || {}) : {};
        
        updates['stats/baseRaceStats'] = newRaceStats;
        updates['stats/baseClassStats'] = newClassStats;

        const oldMaxHp = currentPlayer.maxHp || calculateHP(currentPlayer.race, currentPlayer.classMain, calculateTotalStat(currentPlayer, 'CON'));
        const isHpFull = currentPlayer.hp >= oldMaxHp;
        
        let tempPlayer = JSON.parse(JSON.stringify(currentPlayer));
        tempPlayer.classMain = newClassMain;
        tempPlayer.race = newRaceName;
        if(!tempPlayer.stats) tempPlayer.stats = {};
        tempPlayer.stats.baseRaceStats = newRaceStats;
        tempPlayer.stats.baseClassStats = newClassStats;
        
        const newMaxHp = calculateHP(tempPlayer.race, tempPlayer.classMain, calculateTotalStat(tempPlayer, 'CON'));
        updates['maxHp'] = newMaxHp;
        
        if (isHpFull) updates['hp'] = newMaxHp;
        else updates['hp'] = Math.min(currentPlayer.hp, newMaxHp);
    }
    
    db.ref(`rooms/${roomId}/playersByUid/${uid}`).update(updates).then(() => {
        showCustomAlert("บันทึกข้อมูลทั่วไปเรียบร้อย!", 'success');
    });
}
function saveStats() {
    const roomId = sessionStorage.getItem('roomId');
    const name = document.getElementById("playerSelect").value;
    const uid = getUidByName(name);
    if (!roomId || !uid) return;
    const tempStats = {
        STR: parseInt(document.getElementById('editSTRTemp').value) || 0,
        DEX: parseInt(document.getElementById('editDEXTemp').value) || 0,
        CON: parseInt(document.getElementById('editCONTemp').value) || 0,
        INT: parseInt(document.getElementById('editINTTemp').value) || 0,
        WIS: parseInt(document.getElementById('editWISTemp').value) || 0,
        CHA: parseInt(document.getElementById('editCHATemp').value) || 0,
    };
    db.ref(`rooms/${roomId}/playersByUid/${uid}/stats/tempStats`).set(tempStats).then(() => showCustomAlert("บันทึกบัฟ/ดีบัฟ (God Mode) เรียบร้อย!", 'success'));
}
function changeLevel(change) {
    const roomId = sessionStorage.getItem('roomId');
    const name = document.getElementById("playerSelect").value;
    const uid = getUidByName(name);
    const player = allPlayersDataByUID[uid];
    if (!roomId || !player) return;
    let newLevel = (player.level || 1) + change;
    if (newLevel < 1) newLevel = 1;
    let newFreePoints = player.freeStatPoints || 0;
    if (change > 0) newFreePoints += (change * 2);
    else if (change < 0 && player.level > 1) newFreePoints = Math.max(0, newFreePoints + (change * 2));
    
    const newExpToNext = getExpForNextLevel(newLevel);
    
    db.ref(`rooms/${roomId}/playersByUid/${uid}`).update({
        level: newLevel,
        freeStatPoints: newFreePoints,
        expToNextLevel: newExpToNext
    });
}
function applyTempLevel() {
    const roomId = sessionStorage.getItem('roomId');
    const name = document.getElementById("playerSelect").value;
    const uid = getUidByName(name);
    if (!roomId || !uid) return;
    const tempLevel = parseInt(document.getElementById("tempLevelInput").value) || 0;
    
    db.ref(`rooms/${roomId}/playersByUid/${uid}/activeEffects`).transaction(effects => {
        if (!Array.isArray(effects)) effects = [];
        effects = effects.filter(e => e.skillId !== 'dm_temp_level_buff');
        if (tempLevel !== 0) { 
            effects.push({
                skillId: 'dm_temp_level_buff', name: 'DM Level Adjust', type: tempLevel > 0 ? 'BUFF' : 'DEBUFF',
                stat: 'Level', modType: 'FLAT', amount: tempLevel, turnsLeft: 999 
            });
        }
        return effects;
    }).then(() => {
        showCustomAlert("ใช้บัฟ/ดีบัฟเลเวลชั่วคราวเรียบร้อย!", 'success');
    });
}
function clearTempLevel() { 
    document.getElementById("tempLevelInput").value = 0; 
    applyTempLevel();
}
function deletePlayer() {
    const roomId = sessionStorage.getItem('roomId');
    const name = document.getElementById("playerSelect").value;
    const uid = getUidByName(name);
    if (!roomId || !uid) return;
    Swal.fire({
        title: 'ยืนยันการลบ?', text: `ต้องการลบ "${name}"?`, icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ใช่, ลบเลย!'
    }).then((result) => {
        if (result.isConfirmed) db.ref(`rooms/${roomId}/playersByUid/${uid}`).remove();
    });
}
function awardExp() {
    const roomId = sessionStorage.getItem('roomId');
    const name = document.getElementById("playerSelect").value;
    const uid = getUidByName(name);
    const awardExpAmountEl = document.getElementById("awardExpAmount");
    const amount = parseInt(awardExpAmountEl.value);
    if (!uid || !awardExpAmountEl || isNaN(amount) || amount <= 0) return showCustomAlert('กรุณาเลือกผู้เล่นและใส่ค่า EXP ที่เป็นบวก!', 'warning');
    const playerRef = db.ref(`rooms/${roomId}/playersByUid/${uid}`);
    playerRef.transaction((player) => {
        if (player) {
            player.exp = (player.exp || 0) + amount;
            let levelUpCount = 0;
            while (player.exp >= player.expToNextLevel) {
                levelUpCount++;
                player.exp -= player.expToNextLevel;
                player.level = (player.level || 1) + 1;
                player.freeStatPoints = (player.freeStatPoints || 0) + 2;
                player.expToNextLevel = getExpForNextLevel(player.level);
                
                const finalCon = calculateTotalStat(player, 'CON');
                const newMaxHp = calculateHP(player.race, player.classMain, finalCon);
                player.maxHp = newMaxHp;
                player.hp = newMaxHp; 
            }
            if (levelUpCount > 0) setTimeout(() => showCustomAlert(`${player.name} Level Up! x${levelUpCount}`, 'success'), 100);
        }
        return player;
    }).then(() => {
        showCustomAlert(`มอบ EXP ${amount} ให้ ${name} สำเร็จ!`, 'info');
        awardExpAmountEl.value = '';
    }).catch(error => showCustomAlert('เกิดข้อผิดพลาดในการมอบ EXP!', 'error'));
}

// =================================================================================
// ส่วนที่ 5: Write Functions (Item, Enemy, Quest, Room)
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

function addItem() {
    const roomId = sessionStorage.getItem('roomId');
    const name = document.getElementById("playerSelect").value;
    const uid = getUidByName(name);
    const itemName = document.getElementById("itemName").value.trim();
    if (!roomId || !uid || !itemName) return;
    const itemQty = parseInt(document.getElementById("itemQty").value) || 1;
    const player = allPlayersDataByUID[uid];
    const inventory = player.inventory || [];
    const existingItem = inventory.find(i => i.name === itemName && !i.bonuses);
    if (existingItem) existingItem.quantity += itemQty;
    else inventory.push({ name: itemName, quantity: itemQty, itemType: 'ทั่วไป', durability: 100 });
    db.ref(`rooms/${roomId}/playersByUid/${uid}/inventory`).set(inventory);
}
function removeItem() {
    const roomId = sessionStorage.getItem('roomId');
    const name = document.getElementById("playerSelect").value;
    const uid = getUidByName(name);
    const selectedIndex = document.getElementById("itemSelect").value;
    if (!roomId || !uid || selectedIndex === null || selectedIndex === "") return showCustomAlert("กรุณาเลือกผู้เล่นและไอเทมที่ต้องการลบ", "warning");
    const itemIndex = parseInt(selectedIndex);
    const qtyToRemove = parseInt(document.getElementById("removeQty").value) || 1;
    const player = allPlayersDataByUID[uid];
    let inventory = player.inventory || [];
    if (itemIndex < 0 || itemIndex >= inventory.length) return showCustomAlert("ไม่พบไอเทมที่ต้องการลบ (Invalid Index)", "error");
    if (inventory[itemIndex].quantity <= qtyToRemove) inventory.splice(itemIndex, 1);
    else inventory[itemIndex].quantity -= qtyToRemove;
    db.ref(`rooms/${roomId}/playersByUid/${uid}/inventory`).set(inventory).then(() => showCustomAlert(`ลบไอเทมจาก ${name} สำเร็จ`, 'success'));
}

/**
 * [ ⭐️ KONGFA-FIX ⭐️ ]
 * อัปเกรด `sendCustomItem` ให้อ่าน UI ใหม่
 */
function sendCustomItem(sendToAll = false) { 
    const roomId = sessionStorage.getItem('roomId');
    const itemName = document.getElementById("customItemName").value.trim();
    if (!roomId || !itemName) return showCustomAlert("กรุณาใส่ชื่อไอเทม", 'warning');

    const itemQty = parseInt(document.getElementById("customItemQty").value) || 1;
    const durability = parseInt(document.getElementById("customItemDurability").value) || 100; 
    
    const bonuses = {};
    ['HP', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach(stat => {
        const value = parseInt(document.getElementById(`itemBonus${stat}`).value);
        if (!isNaN(value) && value !== 0) bonuses[stat.toUpperCase()] = value;
    });
    
    const itemType = document.getElementById('customItemType').value;
    let newItem = { 
        name: itemName, 
        quantity: itemQty, 
        bonuses: bonuses, 
        originalBonuses: { ...bonuses }, 
        itemType: itemType,
        durability: durability 
    };
    
    // [ ⭐️ KONGFA-FIX ⭐️ ] อ่านข้อมูล Consumable ใหม่
    if (itemType === 'บริโภค') {
        newItem.effects = {
            heal: parseInt(document.getElementById('itemEffectHeal').value) || 0,
            permStats: [],
            tempStats: []
        };
        // วนลูป 6 ช่อง
        for (let i = 1; i <= 6; i++) {
            // บัฟถาวร
            const permStat = document.getElementById(`itemPermStat${i}`).value;
            const permAmount = parseInt(document.getElementById(`itemPermAmount${i}`).value);
            if (permStat && permAmount) {
                newItem.effects.permStats.push({ stat: permStat, amount: permAmount });
            }
            // บัฟชั่วคราว
            const tempStat = document.getElementById(`itemTempStat${i}`).value;
            const tempAmount = parseInt(document.getElementById(`itemTempAmount${i}`).value);
            const tempTurns = parseInt(document.getElementById(`itemTempTurns${i}`).value);
            if (tempStat && tempAmount && tempTurns) {
                newItem.effects.tempStats.push({ stat: tempStat, amount: tempAmount, turns: tempTurns });
            }
        }
        
    } else if (itemType === 'สวมใส่') {
        newItem.slot = document.getElementById('customItemSlot').value;
    } else if (itemType === 'อาวุธ') {
        newItem.damageDice = document.getElementById('customDamageDice').value || 'd6';
        newItem.weaponType = document.getElementById('customWeaponType').value;
        newItem.recommendedClass = [];
        document.querySelectorAll('#recommendedClassCheckboxes input:checked').forEach(cb => {
            newItem.recommendedClass.push(cb.value);
        });
    }

    const processSend = (uid, playerName) => {
        const player = allPlayersDataByUID[uid];
        const inventory = player.inventory || [];
        
        // (ปรับปรุงการ stack: ไอเทมทั่วไป/บริโภคที่ไม่มีโบนัส/เอฟเฟกต์ซับซ้อน จะ stack ได้)
        const isStackable = (itemType === 'ทั่วไป' || itemType === 'บริโภค') && 
                            JSON.stringify(bonuses) === '{}' &&
                            (!newItem.effects || (newItem.effects.permStats.length === 0 && newItem.effects.tempStats.length === 0 && newItem.effects.heal === 0));

        const existingItemIndex = inventory.findIndex(i => 
            i.name === itemName && 
            ( (isStackable && i.itemType === itemType) || // Stack ไอเทมทั่วไป
              (!isStackable && JSON.stringify(i.originalBonuses || {}) === JSON.stringify(newItem.originalBonuses || {})) // Stack ไอเทมมีโบนัส (ตรรกะเดิม)
            )
        );

        if (existingItemIndex > -1 && isStackable) {
            inventory[existingItemIndex].quantity += itemQty;
        } else {
            inventory.push(JSON.parse(JSON.stringify(newItem))); // (ต้อง Deep Copy)
        }
        
        return db.ref(`rooms/${roomId}/playersByUid/${uid}/inventory`).set(inventory);
    };

    if (sendToAll) { 
        const allPromises = [];
        for (const uid in allPlayersDataByUID) {
            allPromises.push(processSend(uid, allPlayersDataByUID[uid].name));
        }
        Promise.all(allPromises).then(() => showCustomAlert(`ส่งไอเทม "${itemName}" ให้ผู้เล่นทุกคนสำเร็จ`, 'success'));
    } else {
        const name = document.getElementById("playerSelect").value;
        const uid = getUidByName(name);
        if (!uid) return showCustomAlert("กรุณาเลือกผู้เล่น", 'warning');
        processSend(uid, name).then(() => showCustomAlert(`ส่งไอเทม "${itemName}" ให้ ${name} สำเร็จ`, 'success'));
    }
}

const monsterTemplates = { 'Goblin': { hp: 5, str: 8, dex: 14, con: 10, int: 8, wis: 10, cha: 6, damageDice: 'd6' }, 'Orc': { hp: 15, str: 16, dex: 12, con: 14, int: 7, wis: 10, cha: 8, damageDice: 'd8' }, 'Dragon (Young)': { hp: 50, str: 20, dex: 10, con: 18, int: 14, wis: 12, cha: 16, damageDice: 'd12' } };
function populateMonsterTemplates() {
    const select = document.getElementById("monsterTemplateSelect");
    select.innerHTML = '<option value="">--- เลือกมอนสเตอร์ ---</option>';
    for (const name in monsterTemplates) select.innerHTML += `<option value="${name}">${name}</option>`;
}
function loadMonsterTemplate() {
    const selectedName = document.getElementById("monsterTemplateSelect").value;
    const template = monsterTemplates[selectedName];
    if (template) {
        document.getElementById("monsterHp").value = template.hp;
        document.getElementById("monsterStr").value = template.str;
        document.getElementById("monsterDex").value = template.dex;
        document.getElementById("monsterCon").value = template.con || 10;
        document.getElementById("monsterInt").value = template.int || 10;
        document.getElementById("monsterWis").value = template.wis || 10;
        document.getElementById("monsterCha").value = template.cha || 10;
        document.getElementById("monsterDamageDice").value = template.damageDice || 'd6';
    }
}
function addMonster(addPerPlayer) {
    const roomId = sessionStorage.getItem('roomId');
    const monsterName = document.getElementById("monsterTemplateSelect").value;
    if (!monsterName) return showCustomAlert("กรุณาเลือกมอนสเตอร์จาก Template ก่อน", 'warning');
    const createEnemyObject = () => {
        const hp = parseInt(document.getElementById("monsterHp").value) || 10;
        return {
            name: monsterName, hp: hp, maxHp: hp, damageDice: document.getElementById("monsterDamageDice").value || 'd6',
            expValue: 0, 
            stats: { STR: parseInt(document.getElementById("monsterStr").value) || 10, DEX: parseInt(document.getElementById("monsterDex").value) || 10, CON: parseInt(document.getElementById("monsterCon").value) || 10, INT: parseInt(document.getElementById("monsterInt").value) || 10, WIS: parseInt(document.getElementById("monsterWis").value) || 10, CHA: parseInt(document.getElementById("monsterCha").value) || 10, },
            targetUid: document.getElementById('enemyInitialTarget').value,
            abilities: { canDefend: false } 
        };
    };
    const enemiesRef = db.ref(`rooms/${roomId}/enemies`);
    if (addPerPlayer) {
        let playerIndex = 1;
        Object.keys(allPlayersDataByUID).forEach(uid => {
            const enemyData = createEnemyObject();
            enemyData.targetUid = uid;
            enemyData.name = `${monsterName} #${playerIndex++}`
            enemiesRef.push(enemyData);
        });
        showCustomAlert(`เพิ่ม ${monsterName} ตามจำนวนผู้เล่นสำเร็จ!`, 'success');
    } else {
        enemiesRef.push(createEnemyObject());
        showCustomAlert(`เพิ่ม ${monsterName} 1 ตัว สำเร็จ!`, 'success');
    }
}
async function addCustomEnemy() {
  const roomId = sessionStorage.getItem('roomId');
  if (!roomId) return showCustomAlert("ไม่พบรหัสห้อง!", "error");
  const name = document.getElementById("customEnemyName").value.trim();
  const hp = parseInt(document.getElementById("customEnemyHp").value) || 0;
  const str = parseInt(document.getElementById("customEnemyStr").value) || 10;
  const dex = parseInt(document.getElementById("customEnemyDex").value) || 10;
  const con = parseInt(document.getElementById("customEnemyCon").value) || 10;
  const intt = parseInt(document.getElementById("customEnemyInt").value) || 10;
  const wis = parseInt(document.getElementById("customEnemyWis").value) || 10;
  const cha = parseInt(document.getElementById("customEnemyCha").value) || 10;
  const damageDice = document.getElementById("customEnemyDamageDice").value.trim() || "d6";
  
  const canDefend = document.getElementById("customEnemyCanDefend").checked;
  
  if (!name || hp <= 0) return showCustomAlert("กรุณาใส่ชื่อและ HP ให้ครบถ้วน!", "warning");
  const enemyData = { 
      name, hp, maxHp: hp, damageDice, 
      stats: { STR: str, DEX: dex, CON: con, INT: intt, WIS: wis, CHA: cha }, 
      type: "enemy", 
      targetUid: document.getElementById('enemyInitialTarget').value, 
      createdAt: Date.now(),
      abilities: { canDefend: canDefend } 
  };
  try {
    await db.ref(`rooms/${roomId}/enemies`).push(enemyData);
    showCustomAlert(`เพิ่มศัตรู "${name}" สำเร็จ!`, "success");
  } catch (error) { showCustomAlert("เกิดข้อผิดพลาดในการเพิ่มศัตรู", "error"); }
}
function moveEnemy(enemyKey) {
    const roomId = sessionStorage.getItem('roomId');
    let options = { 'shared': 'ยังไม่กำหนดเป้าหมาย (ศัตรูร่วม)' };
    for (const uid in allPlayersDataByUID) options[uid] = allPlayersDataByUID[uid].name;
    Swal.fire({
        title: 'ย้ายเป้าหมาย', input: 'select', inputOptions: options,
        inputPlaceholder: 'เลือกเป้าหมายใหม่', showCancelButton: true, confirmButtonText: 'ย้าย'
    }).then((result) => {
        if (result.isConfirmed && result.value) db.ref(`rooms/${roomId}/enemies/${enemyKey}`).update({ targetUid: result.value });
    });
}
function deleteEnemy(enemyKey) {
    const roomId = sessionStorage.getItem('roomId');
    Swal.fire({
        title: 'ยืนยันการลบ?', text: `ต้องการลบ "${allEnemies[enemyKey].name}" ออกจากฉาก?`, icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ใช่, ลบเลย!', confirmButtonColor: '#c82333'
    }).then((result) => {
        if (result.isConfirmed) db.ref(`rooms/${roomId}/enemies/${enemyKey}`).remove();
    });
}
function clearAllEnemies() {
    const roomId = sessionStorage.getItem('roomId');
    Swal.fire({
        title: 'ยืนยันการล้างบาง?', text: "ต้องการลบคู่ต่อสู้ทั้งหมดในฉากหรือไม่?", icon: 'error',
        showCancelButton: true, confirmButtonText: 'ใช่, ล้างทั้งหมด!', confirmButtonColor: '#c82333'
    }).then((result) => {
        if (result.isConfirmed) db.ref(`rooms/${roomId}/enemies`).remove().then(() => showCustomAlert('ล้างคู่ต่อสู้ทั้งหมดเรียบร้อย!', 'success'));
    });
}
function saveStory() {
    const roomId = sessionStorage.getItem('roomId');
    const storyText = document.getElementById("story").value;
    if (roomId) db.ref(`rooms/${roomId}/story`).set(storyText);
}

function sendQuest(sendToAll = false) {
    const roomId = sessionStorage.getItem('roomId');
    const quest = {
        title: document.getElementById("questTitle").value,
        detail: document.getElementById("questDetail").value,
        reward: document.getElementById("questReward").value,
        expReward: parseInt(document.getElementById("questExpReward").value) || 0
    };
    if (!quest.title.trim()) return showCustomAlert("กรุณาระบุชื่อเควส", 'warning');

    if (sendToAll) { 
        const updates = {};
        for (const uid in allPlayersDataByUID) {
            updates[`/rooms/${roomId}/playersByUid/${uid}/quest`] = quest;
        }
        db.ref().update(updates).then(() => showCustomAlert("ส่งเควสให้ผู้เล่นทุกคนแล้ว!", "success"));
    } else {
        const playerName = document.getElementById("playerSelect").value;
        const uid = getUidByName(playerName);
        if (!uid) return showCustomAlert("กรุณาเลือกผู้เล่น", 'warning');
        db.ref(`rooms/${roomId}/playersByUid/${uid}/quest`).set(quest).then(() => showCustomAlert(`ส่งเควสให้ ${playerName} แล้ว!`, "success"));
    }
}
function completeQuest() {
    const roomId = sessionStorage.getItem('roomId');
    const playerName = document.getElementById("playerSelect").value;
    const uid = getUidByName(playerName);
    if (roomId && uid) db.ref(`rooms/${roomId}/playersByUid/${uid}/quest`).remove().then(() => showCustomAlert("ยืนยันเควสสำเร็จแล้ว (อย่าลืมมอบ EXP!)", "success"));
}
function cancelQuest() {
    const roomId = sessionStorage.getItem('roomId');
    const playerName = document.getElementById("playerSelect").value;
    const uid = getUidByName(playerName);
    if (roomId && uid) db.ref(`rooms/${roomId}/playersByUid/${uid}/quest`).remove().then(() => showCustomAlert("ยกเลิกเควสแล้ว", "info"));
}

function changeRoomPassword() {
    const roomId = sessionStorage.getItem('roomId');
    if (!roomId) return;
    Swal.fire({ title: '🔑 เปลี่ยนรหัสเข้าห้อง', input: 'password', showCancelButton: true }).then((result) => {
        if (result.isConfirmed && result.value) db.ref(`rooms/${roomId}/password`).set(result.value);
    });
}
function changeDMPassword() {
    const roomId = sessionStorage.getItem('roomId');
    if (!roomId) return;
    Swal.fire({ title: '🔒 เปลี่ยนรหัส DM Panel', input: 'password', showCancelButton: true }).then((result) => {
        if (result.isConfirmed && result.value) db.ref(`rooms/${roomId}/dmPassword`).set(result.value);
    });
}
function deleteRoom() {
    const roomId = sessionStorage.getItem('roomId');
    if (!roomId) return;
    Swal.fire({
        title: '💣 ยืนยันการลบห้องถาวร?', text: "การกระทำนี้ไม่สามารถย้อนกลับได้!", icon: 'error',
        showCancelButton: true, confirmButtonText: 'ใช่, ลบห้องเลย!'
    }).then((result) => {
        if (result.isConfirmed) db.ref(`rooms/${roomId}`).remove().then(() => {
            sessionStorage.removeItem('roomId');
            window.location.replace('lobby.html');
        });
    });
}
async function rollDmDice() {
    const diceType = parseInt(document.getElementById("dmDiceType").value);
    const diceCount = parseInt(document.getElementById("dmDiceCount").value);
    const rollButton = document.querySelector('button[onclick="rollDmDice()"]');
    if (typeof showDiceRollAnimation === 'function') await showDiceRollAnimation(diceType, diceCount, 'dm-dice-animation-area', 'dmDiceResult', rollButton);
    else showCustomAlert("ฟังก์ชันทอยเต๋าไม่พร้อมใช้งาน", 'error');
}
function clearDiceLogs() { const roomId = sessionStorage.getItem('roomId'); if (roomId) db.ref(`rooms/${roomId}/diceLogs`).set(null); }
function clearCombatLogs() { const roomId = sessionStorage.getItem('roomId'); if (roomId) db.ref(`rooms/${roomId}/combatLogs`).set(null); }

// =================================================================================
// ส่วนที่ 5: [ใหม่ v3] Write Functions (Shop & Guild)
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

async function addShopItemToDB() {
    const roomId = sessionStorage.getItem('roomId');
    const shopId = document.getElementById("shopIdSelect").value;
    if (!roomId || !shopId) return showCustomAlert("กรุณาเลือกประเภทร้านค้า", 'warning');

    const itemName = document.getElementById("shopItemName").value.trim();
    const price = parseInt(document.getElementById("shopItemPrice").value);
    const durability = parseInt(document.getElementById("shopItemDurability").value) || 100;
    if (!itemName || isNaN(price) || price < 0) return showCustomAlert("กรุณากรอก ชื่อ, ราคา, และความทนทาน ให้ถูกต้อง", 'warning');
    
    const bonuses = {};
    ['HP', 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].forEach(stat => {
        const value = parseInt(document.getElementById(`itemBonus${stat}`).value);
        if (!isNaN(value) && value !== 0) bonuses[stat.toUpperCase()] = value;
    });
    const itemType = document.getElementById('customItemType').value;
    
    const newItem = { 
        name: itemName, 
        price: price,
        durability: durability,
        bonuses: bonuses, 
        originalBonuses: { ...bonuses }, 
        itemType: itemType,
    };
    
    // [ ⭐️ KONGFA-FIX ⭐️ ] อ่านข้อมูล Consumable (เผื่อขายยาในร้าน)
    if (itemType === 'บริโภค') {
        newItem.effects = {
            heal: parseInt(document.getElementById('itemEffectHeal').value) || 0,
            permStats: [],
            tempStats: []
        };
        for (let i = 1; i <= 6; i++) {
            const permStat = document.getElementById(`itemPermStat${i}`).value;
            const permAmount = parseInt(document.getElementById(`itemPermAmount${i}`).value);
            if (permStat && permAmount) {
                newItem.effects.permStats.push({ stat: permStat, amount: permAmount });
            }
            const tempStat = document.getElementById(`itemTempStat${i}`).value;
            const tempAmount = parseInt(document.getElementById(`itemTempAmount${i}`).value);
            const tempTurns = parseInt(document.getElementById(`itemTempTurns${i}`).value);
            if (tempStat && tempAmount && tempTurns) {
                newItem.effects.tempStats.push({ stat: tempStat, amount: tempAmount, turns: tempTurns });
            }
        }
    } else if (itemType === 'สวมใส่') {
        newItem.slot = document.getElementById('customItemSlot').value;
    } else if (itemType === 'อาวุธ') {
        newItem.damageDice = document.getElementById('customDamageDice').value || 'd6';
        newItem.weaponType = document.getElementById('customWeaponType').value;
        newItem.recommendedClass = [];
        document.querySelectorAll('#recommendedClassCheckboxes input:checked').forEach(cb => {
            newItem.recommendedClass.push(cb.value);
        });
    }

    const shopRef = db.ref(`rooms/${roomId}/shops/${shopId}`);
    try {
        await shopRef.push(newItem);
        showCustomAlert(`เพิ่ม '${itemName}' ในร้านค้า '${shopId}' สำเร็จ!`, 'success');
        document.getElementById("shopItemName").value = '';
        document.getElementById("shopItemPrice").value = '';
    } catch (error) {
        showCustomAlert("ล้มเหลวในการเพิ่มไอเทมเข้าร้าน: " + error.message, 'error');
    }
}

async function addGuildQuestToDB() {
    const roomId = sessionStorage.getItem('roomId');
    const questTitle = document.getElementById("guildQuestTitle").value.trim();
    const forClass = document.getElementById("guildQuestForClass").value;
    const forLevel = parseInt(document.getElementById("guildQuestForLevel").value);
    
    if (!roomId || !questTitle || !forClass || isNaN(forLevel)) {
        return showCustomAlert("กรุณากรอกข้อมูลเควสเลื่อนขั้นให้ครบ", 'warning');
    }
    
    const questId = `quest_${forClass}_${forLevel}`;
    const questData = {
        title: questTitle,
        description: document.getElementById("guildQuestDesc").value || "ทำภารกิจให้สำเร็จ",
        requiredClass: forClass,
        requiredLevel: forLevel,
    };
    
    const guildRef = db.ref(`rooms/${roomId}/guild/quests/${questId}`);
    try {
        await guildRef.set(questData);
        showCustomAlert(`เพิ่มเควส '${questTitle}' สำหรับ Lv.${forLevel} ${forClass} สำเร็จ!`, 'success');
    } catch (error) {
        showCustomAlert("ล้มเหลวในการเพิ่มเควส: " + error.message, 'error');
    }
}

// =================================================================================
// ส่วนที่ 6: Initial Load & Real-time Listeners
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================================

/**
 * [ ⭐️ KONGFA-FIX 2 ⭐️ ]
 * [อัปเกรด v3] Listener สัญญาณจบเทิร์น (ข้อ 7)
 * (แก้ไขให้รับสัญญาณจาก Enemy ได้)
 */
function listenForActionComplete() {
  const roomId = sessionStorage.getItem('roomId');
  const actionRef = db.ref(`rooms/${roomId}/combat/actionComplete`);

  actionRef.on('value', async (snap) => {
    const uidOrKey = snap.val(); // (อาจจะเป็น UID ผู้เล่น หรือ Key ศัตรู)
    
    // 1. ถ้าไม่มีสัญญาณ ให้ return
    if (!uidOrKey) return;

    // 2. [FIX] ตรวจสอบว่าสัญญาณ (uidOrKey) มาจากยูนิตที่กำลังเล่นอยู่หรือไม่
    const currentUnit = combatState?.turnOrder?.[combatState?.currentTurnIndex];
    if (!currentUnit || uidOrKey !== currentUnit.id) {
        // (ถ้าสัญญาณมาจากเทิร์นที่แล้ว ให้เคลียร์ทิ้ง)
        if (currentUnit && uidOrKey !== currentUnit.id) {
            console.warn(`[DM] Received STALE signal from ${uidOrKey}, but current turn is ${currentUnit.name}. Clearing signal.`);
            await actionRef.remove();
        }
        return; 
    }
    
    // (ถ้าผ่าน)
    console.log(`[DM] ได้รับ Signal จบเทิร์นจาก ${uidOrKey} (ตรงกับเทิร์นปัจจุบัน)`);
    await actionRef.remove(); // เคลียร์ค่า
    await advanceTurn(); // เรียกเทิร์นถัดไป
  });
}

function listenForDefenseResolution() {
    const roomId = sessionStorage.getItem('roomId');
    const resolutionRef = db.ref(`rooms/${roomId}/combat/resolution`);
    resolutionRef.on('value', (snapshot) => {
        if (snapshot.exists() && snapshot.val() !== null) {
            handleDefenseResolution(snapshot.val());
        }
    });
}


/**
 * [ ⭐️ KONGFA-FIX ⭐️ ]
 * (ฟังก์ชันสำหรับสร้าง UI ไอเทมบริโภค)
 */
function populateConsumableInputs() {
    const permContainer = document.getElementById('permStatContainer');
    const tempContainer = document.getElementById('tempStatContainer');
    const statOptions = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'HP', 'MaxHP'];
    let permHtml = '';
    let tempHtml = '';

    for (let i = 1; i <= 6; i++) {
        // สร้างช่องบัฟถาวร
        permHtml += `<label>ช่องที่ ${i}:</label>
            <select id="itemPermStat${i}" style="grid-column: 1 / 2;">
                <option value="">--เลือกค่า--</option>
                ${statOptions.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <input type="number" id="itemPermAmount${i}" placeholder="+ จำนวน" style="grid-column: 2 / 3;">
        `;
        
        // สร้างช่องบัฟชั่วคราว
        tempHtml += `<label>ช่องที่ ${i}:</label>
            <select id="itemTempStat${i}" style="grid-column: 1 / 2;">
                <option value="">--เลือกค่า--</option>
                ${statOptions.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <input type="number" id="itemTempAmount${i}" placeholder="+ จำนวน" style="grid-column: 2 / 3;">
            <input type="number" id="itemTempTurns${i}" placeholder="เทิร์น" style="grid-column: 3 / 4;">
        `;
    }
    permContainer.innerHTML = permHtml;
    tempContainer.innerHTML = tempHtml;
}


window.onload = function() {
    // [ ⭐️ KONGFA-FIX ⭐️ ]
    // (เรียกใช้ฟังก์ชันจาก charector.js เพื่อให้ dm-panel-script.js เรียกใช้ได้)
    if (typeof getRaceStatBonus === 'function') {
        window.calculateHP_CORE = calculateHP; // (เก็บตัวจริงไว้ใน global)
    } else {
        console.error("charector.js (calculateHP) is not loaded before dm-panel-script.js!");
    }
    // (โหลด ui-helpers.js)
    if (typeof showCustomAlert === 'function') {
         window.showCustomAlert_UI = showCustomAlert;
    } else {
        console.error("ui-helpers.js (showCustomAlert) is not loaded before dm-panel-script.js!");
    }


    const roomId = sessionStorage.getItem('roomId');
    if (!roomId) {
        window.location.replace('lobby.html');
        return;
    }

    listenForActionComplete(); 
    listenForDefenseResolution();

    const playersRef = db.ref(`rooms/${roomId}/playersByUid`);
    playersRef.on('value', (snapshot) => {
        allPlayersDataByUID = snapshot.val() || {};

        const select = document.getElementById("playerSelect");
        const enemyTargetSelect = document.getElementById("enemyInitialTarget");
        const previouslySelectedName = select.value;

        select.innerHTML = '<option value="">--- เลือกผู้เล่น ---</option>';
        enemyTargetSelect.innerHTML = '<option value="shared">ยังไม่กำหนดเป้าหมาย (ศัตรูร่วม)</option>';

        let foundSelected = false;
        for (let uid in allPlayersDataByUID) {
            const player = allPlayersDataByUID[uid];
            select.innerHTML += `<option value="${player.name}">${player.name}</option>`;
            enemyTargetSelect.innerHTML += `<option value="${uid}">${player.name}</option>`;
            if (player.name === previouslySelectedName) foundSelected = true;
        }

        if (foundSelected) {
            select.value = previouslySelectedName;
            loadPlayer(); 
        } else {
            resetPlayerEditor();
        }
        // [FIX] อัปเดต UI เทิร์นเสมอ เมื่อข้อมูลผู้เล่นเปลี่ยน
        displayCombatState(combatState); 
    });

    const enemiesRef = db.ref(`rooms/${roomId}/enemies`);
    enemiesRef.on('value', (snapshot) => {
        allEnemies = snapshot.val() || {};
        displayAllEnemies(allEnemies);
        // [FIX] อัปเดต UI เทิร์นเสมอ เมื่อข้อมูลศัตรูเปลี่ยน
        displayCombatState(combatState);
    });

    const combatRef = db.ref(`rooms/${roomId}/combat`);
    combatRef.on('value', (snapshot) => {
        combatState = snapshot.val() || {};
        displayCombatState(combatState); 
    });

    const roomRef = db.ref(`rooms/${roomId}`);
    roomRef.child('diceLogs').on('value', s => displayDiceLog(s.val(), 'playerDiceLog'));
    roomRef.child('combatLogs').on('value', s => displayDiceLog(s.val(), 'playerCombatLog'));
    roomRef.child('story').on('value', s => {
        const storyEl = document.getElementById("story");
        if(storyEl) storyEl.value = s.val() || "";
    });

    populateMonsterTemplates();
    
    // [ ⭐️ KONGFA-FIX ⭐️ ] โหลด UI ใหม่
    populateClassCheckboxes(); 
    populateWeaponTypes(); 
    populateRaceAndClassDropdowns(); 
    populateConsumableInputs(); // (สร้าง UI 6 ช่องสำหรับยา)

    document.getElementById("playerSelect").addEventListener('change', loadPlayer);
};

function populateClassCheckboxes() {
    const container = document.getElementById('recommendedClassCheckboxes');
    if (!container) return;
    container.innerHTML = '';
    ALL_CLASSES.forEach(className => {
        container.innerHTML += `
            <div style="display: flex; align-items: center;">
                <input type="checkbox" id="cb-${className}" value="${className}" style="width: auto; margin-top: 0;">
                <label for="cb-${className}" style="margin: 0 5px;">${className}</label>
            </div>
        `;
    });
}
function populateWeaponTypes() {
    const select = document.getElementById('customWeaponType');
    if (!select) return;
    select.innerHTML = '';
    ALL_WEAPON_TYPES.forEach(type => {
        select.innerHTML += `<option value="${type}">${type}</option>`;
    });
}
function toggleItemFields() {
    const type = document.getElementById('customItemType').value;
    document.getElementById('equipmentFields').classList.toggle('hidden', type !== 'สวมใส่');
    document.getElementById('weaponFields').classList.toggle('hidden', type !== 'อาวุธ');
    document.getElementById('consumableFields').classList.toggle('hidden', type !== 'บริโภค');
}

function populateRaceAndClassDropdowns() {
    const raceSelect = document.getElementById('editRace');
    if (raceSelect) {
        raceSelect.innerHTML = '';
        ALL_RACES.forEach(raceName => {
            raceSelect.innerHTML += `<option value="${raceName}">${raceName}</option>`;
        });
    }
    const classMainSelect = document.getElementById('editClassMain');
    const classSubSelect = document.getElementById('editClassSub');
    if (classMainSelect && classSubSelect) {
        classMainSelect.innerHTML = '';
        classSubSelect.innerHTML = '<option value="">-- ไม่มี --</option>';
        ALL_CLASSES.forEach(className => {
            classMainSelect.innerHTML += `<option value="${className}">${className}</option>`;
            classSubSelect.innerHTML += `<option value="${className}">${className}</option>`;
        });
    }
    const guildClassSelect = document.getElementById('guildQuestForClass');
    if (guildClassSelect) {
        guildClassSelect.innerHTML = '';
        ALL_CLASSES.forEach(className => {
            guildClassSelect.innerHTML += `<option value="${className}">${className}</option>`;
        });
    }
}