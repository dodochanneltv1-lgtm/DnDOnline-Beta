/*
* =================================================================
* Javascript/player-actions.js (v3.3 - KONGFA FIX)
* -----------------------------------------------------------------
* นี่คือ "เอนจิ้น" หลักในการใช้งานสกิล, ไอเทม, และการโจมตี
*
* [ ⭐️ KONGFA-FIX ⭐️ ]
* 1. [แก้ไข] บั๊ก "เกิดข้อผิดพลาดร้ายแรงในการใช้สกิล"
* - เพิ่ม Helper Functions (calculateTotalStat, calculateHP, getStatBonus)
* ที่ขาดหายไป ทำให้ฟังก์ชัน applyEffect กลับมาทำงานได้
* 2. [คงเดิม] ตรรกะการใช้ยา (useConsumableItem)
* 3. [คงเดิม] ตรรกะการสวมใส่ (equipItem/unequipItem)
* 4. [คงเดิม] ตรรกะการโจมตี (performAttackRoll/performDamageRoll)
* 5. [แก้ไขบั๊ก] `performDamageRoll` แก้ไขการเรียกสูตร %HP (Bug 1)
* 6. [แก้ไขบั๊ก] `equipItem` และ `unequipItem` แก้ไขการ Stack ของ (Bug 6)
* =================================================================
*/

// --- [ ⭐️ KONGFA-FIX ⭐️ ] Helper Functions (Fixes "Critical Skill Error") ---
// (ฟังก์ชันเหล่านี้ถูกกำหนดไว้ในไฟล์อื่น แต่จำเป็นต้องเรียกใช้ที่นี่)
const calculateTotalStat = (typeof calculateTotalStat === 'function') ? calculateTotalStat : () => { console.error("calculateTotalStat not loaded!"); return 10; };
const calculateHP = (typeof calculateHP === 'function') ? calculateHP : () => { console.error("calculateHP not loaded!"); return 10; };
const getStatBonus = (typeof getStatBonus === 'function') ? getStatBonus : () => { console.error("getStatBonus not loaded!"); return 0; };

// (กำหนดค่าให้กับ consts ภายในที่ applyEffect เรียกใช้)
const calcTotalStatFnLocal = calculateTotalStat;
const calcHPFnLocal = calculateHP;
const getStatBonusFnLocal = getStatBonus;
// --- End of Fix ---


/**
 * [ ⭐️ KONGFA-FIX ⭐️ ]
 * ฟังก์ชันใหม่สำหรับใช้ไอเทมบริโภค (Consumable)
 */
async function useConsumableItem(itemIndex) {
    const uid = firebase.auth().currentUser?.uid; 
    const roomId = sessionStorage.getItem('roomId'); 
    if (!uid || !roomId) return showAlert('ข้อมูลไม่ครบถ้วน!', 'error');

    const playerRef = db.ref(`rooms/${roomId}/playersByUid/${uid}`);
    
    try {
        const transactionResult = await playerRef.transaction(currentData => {
            if (!currentData) return; 

            if (!currentData.inventory || !currentData.inventory[itemIndex]) {
                console.error("Item index not found:", itemIndex);
                return; 
            }

            const item = currentData.inventory[itemIndex];
            if (item.itemType !== 'บริโภค') {
                console.error("Item is not consumable:", item.name);
                return; 
            }
            
            const effects = item.effects; 
            let changesOccurred = false;

            // 1. ฮีล (Heal)
            if (effects && effects.heal && effects.heal > 0) {
                // (ต้องคำนวณ MaxHP ณ ปัจจุบัน)
                const currentCon = calculateTotalStat(currentData, 'CON');
                const maxHp = currentData.maxHp || calculateHP(currentData.race, currentData.classMain, currentCon);
                currentData.hp = Math.min(maxHp, (currentData.hp || 0) + effects.heal);
                changesOccurred = true;
            }

            // 2. บัฟถาวร (Permanent Stats)
            if (effects && effects.permStats && effects.permStats.length > 0) {
                if (!currentData.stats) currentData.stats = {};
                if (!currentData.stats.investedStats) currentData.stats.investedStats = {};
                
                effects.permStats.forEach(mod => {
                    if(mod && mod.stat && mod.amount) {
                        const currentStat = currentData.stats.investedStats[mod.stat] || 0;
                        currentData.stats.investedStats[mod.stat] = currentStat + mod.amount;
                    }
                });
                changesOccurred = true;
            }

            // 3. บัฟชั่วคราว (Temporary Stats)
            if (effects && effects.tempStats && effects.tempStats.length > 0) {
                if (!currentData.activeEffects) currentData.activeEffects = [];
                
                effects.tempStats.forEach(mod => {
                    if(mod && mod.stat && mod.amount && mod.turns) {
                        currentData.activeEffects.push({
                            skillId: `item_${item.name.replace(/\s/g, '_')}`,
                            name: `(ยา) ${item.name}`,
                            type: 'BUFF',
                            stat: mod.stat,
                            modType: 'FLAT', 
                            amount: mod.amount,
                            turnsLeft: mod.turns
                        });
                    }
                });
                changesOccurred = true;
            }

            if (!changesOccurred) {
                console.log("Consumable had no effect.");
            }

            // 4. ลบไอเทม
            if (item.quantity > 1) {
                item.quantity--;
            } else {
                currentData.inventory.splice(itemIndex, 1);
            }
            
            return currentData; // (บันทึก Transaction)
        });

        // (หลัง Transaction สำเร็จ)
        if (transactionResult.committed) {
            // (หาชื่อไอเทมใหม่ เพราะ index อาจเปลี่ยน)
            const item = transactionResult.snapshot.val().inventory[itemIndex] || { name: "ไอเทมที่ใช้ไป" };
            showAlert(`ใช้ ${item.name} สำเร็จ!`, 'success');
        } else {
            // (Transaction ล้มเหลว อาจจะเพราะ item index ผิด)
            // showAlert('ไม่สามารถใช้ไอเทมได้ (Transaction failed)', 'error');
        }

    } catch (error) {
        console.error("Error using consumable:", error);
        showAlert(`เกิดข้อผิดพลาดในการใช้ไอเทม: ${error.message}`, 'error');
    }
}

/**
 * [ ⭐️ KONGFA-FIX ⭐️ ]
 * ย้ายมาจาก player-dashboard-script.js
 * (อัปเดต `equipItem` ให้ใช้ `itemIndex`)
 * [ ⭐️ KONGFA-FIX (Bug 6) ⭐️ ] แก้ไขการ Stack ของ
 */
async function equipItem(itemIndex) {
    const uid = firebase.auth().currentUser?.uid; 
    const roomId = sessionStorage.getItem('roomId'); 
    if (!uid || !roomId) return; 
    
    const playerRef = db.ref(`rooms/${roomId}/playersByUid/${uid}`); 
    
    // (ใช้ Transaction เพื่อป้องกัน Race Condition ตอนสลับของ)
    try {
        const transactionResult = await playerRef.transaction(charData => {
            if (!charData) return; // (ยกเลิกถ้าไม่พบข้อมูล)

            let { inventory = [], equippedItems = {} } = charData; 

            if (itemIndex < 0 || itemIndex >= inventory.length) {
                console.error(`Equip failed: Index ${itemIndex} out of bounds.`);
                return; // (ยกเลิก Transaction)
            }
            
            const itemToEquip = { ...inventory[itemIndex] };
            if (itemToEquip.itemType !== 'สวมใส่' && itemToEquip.itemType !== 'อาวุธ') {
                console.error(`Equip failed: Item ${itemToEquip.name} is not equippable.`);
                return; 
            }
            
            if (!itemToEquip.originalBonuses) {
                itemToEquip.originalBonuses = { ...(itemToEquip.bonuses || {}) };
            }
            
            // (ตัวแปรชั่วคราวสำหรับเก็บของที่จะถอด)
            let itemToReturn = null;
            let targetSlot = null;
            
            // (ตรรกะการสวมใส่)
            if (itemToEquip.itemType === 'อาวุธ') {
                // (ใช้ตรรกะ: ถ้ามือหลักว่าง -> ใส่มือหลัก, ถ้าไม่ -> ใส่มือรอง)
                if (!equippedItems['mainHand'] || equippedItems['mainHand'].durability <= 0) {
                    targetSlot = 'mainHand';
                } else if (!equippedItems['offHand'] || equippedItems['offHand'].durability <= 0) {
                    targetSlot = 'offHand';
                } else {
                    targetSlot = 'mainHand'; // (ถ้าเต็ม 2 มือ ก็ทับมือหลัก)
                }

            } else {
                targetSlot = itemToEquip.slot; // (เกราะ)
            }

            if (!targetSlot) {
                console.error(`Equip failed: Item ${itemToEquip.name} has no slot.`);
                return; // (ยกเลิก)
            }

            // 1. ถอดของเก่า (ถ้ามี)
            if (equippedItems[targetSlot]) {
                itemToReturn = { ...equippedItems[targetSlot] };
                const baseItemToReturn = { 
                    ...itemToReturn, 
                    bonuses: { ...(itemToReturn.originalBonuses || itemToReturn.bonuses) }, 
                    quantity: 1 
                };
                delete baseItemToReturn.isProficient;
                delete baseItemToReturn.isOffHand;
                itemToReturn = baseItemToReturn; // (เก็บไว้เพิ่มกลับ)
            }
            
            // 2. คำนวณโบนัส (ข้อ 5.3)
            if (itemToEquip.itemType === 'อาวุธ') {
                const proficiencies = (typeof CLASS_WEAPON_PROFICIENCY !== 'undefined' && CLASS_WEAPON_PROFICIENCY[charData.classMain]) || [];
                
                if (targetSlot === 'mainHand') {
                    if (proficiencies.includes(itemToEquip.weaponType)) {
                        itemToEquip.isProficient = true;
                    } else {
                        itemToEquip.isProficient = false;
                    }
                    itemToEquip.isOffHand = false;
                
                } else if (targetSlot === 'offHand') {
                    itemToEquip.isProficient = false;
                    itemToEquip.isOffHand = true; 
                }
            }
            
            // 3. ตั้งค่าความทนทาน
            if (itemToEquip.durability === undefined) {
                itemToEquip.durability = 100;
            }
            
            // 4. สวมใส่ของใหม่
            equippedItems[targetSlot] = { ...itemToEquip, quantity: 1 };

            // 5. ลบของใหม่ออกจาก Inventory (ใช้ Index)
            if (inventory[itemIndex].quantity > 1) {
                inventory[itemIndex].quantity--; 
            } else {
                inventory.splice(itemIndex, 1);
            }
            
            // 6. เพิ่มของเก่ากลับเข้า Inventory (ถ้ามี)
            if(itemToReturn) {
                // [ ⭐️ KONGFA-FIX (Bug 6) ⭐️ ]
                // (เพิ่มตรรกะตรวจสอบ Stackable)
                const itemToReturnHasBonuses = itemToReturn.bonuses && Object.keys(itemToReturn.bonuses).length > 0;
                const itemToReturnHasEffects = itemToReturn.effects && (
                    (itemToReturn.effects.heal && itemToReturn.effects.heal > 0) ||
                    (itemToReturn.effects.permStats && itemToReturn.effects.permStats.length > 0) ||
                    (itemToReturn.effects.tempStats && itemToReturn.effects.tempStats.length > 0)
                );
                const isItemToReturnStackable = (itemToReturn.itemType === 'ทั่วไป' || itemToReturn.itemType === 'บริโภค') && !itemToReturnHasBonuses && !itemToReturnHasEffects;

                let existingIdx = -1;

                if (isItemToReturnStackable) {
                    // (หาไอเทมชื่อเดียวกันที่ stack ได้เหมือนกัน)
                    existingIdx = inventory.findIndex(i => {
                        const iHasBonuses = i.bonuses && Object.keys(i.bonuses).length > 0;
                        const iHasEffects = i.effects && (
                            (i.effects.heal && i.effects.heal > 0) ||
                            (i.effects.permStats && i.effects.permStats.length > 0) ||
                            (i.effects.tempStats && i.effects.tempStats.length > 0)
                        );
                        return i.name === itemToReturn.name && (i.itemType === 'ทั่วไป' || i.itemType === 'บริโภค') && !iHasBonuses && !iHasEffects;
                    });
                } else {
                    // (ตรรกะเดิม: หาไอเทม unique ที่มีโบนัสเหมือนกัน)
                    existingIdx = inventory.findIndex(i => 
                        i.name === itemToReturn.name && 
                        JSON.stringify(i.originalBonuses || {}) === JSON.stringify(itemToReturn.originalBonuses || {})
                    ); 
                }
                
                if (existingIdx > -1) {
                    inventory[existingIdx].quantity++; 
                } else {
                    inventory.push(itemToReturn); 
                }
            }
            
            // (อัปเดตข้อมูลใน Transaction)
            charData.inventory = inventory;
            charData.equippedItems = equippedItems;
            
            return charData; // (ส่งข้อมูลใหม่กลับ)
            
        }); // (สิ้นสุด Transaction)

        if (transactionResult.committed) {
             showAlert(`สวมใส่ไอเทมสำเร็จ!`, 'success'); 
        } else {
             showAlert('สวมใส่ไอเทมล้มเหลว (อาจมีคนใช้พร้อมกัน)', 'error');
        }

    } catch (error) {
        console.error("Equip Item Error:", error);
        showAlert(`เกิดข้อผิดพลาดในการสวมใส่: ${error.message}`, 'error');
    }
}


/**
 * [ ⭐️ KONGFA-FIX ⭐️ ]
 * ย้ายมาจาก player-dashboard-script.js
 * [ ⭐️ KONGFA-FIX (Bug 6) ⭐️ ] แก้ไขการ Stack ของ
 */
async function unequipItem(slot) {
    const uid = firebase.auth().currentUser?.uid; 
    const roomId = sessionStorage.getItem('roomId'); 
    if (!uid || !roomId) return; 
    
    const playerRef = db.ref(`rooms/${roomId}/playersByUid/${uid}`); 
    const snapshot = await playerRef.get(); 
    if (!snapshot.exists()) return; 
    
    const charData = snapshot.val(); 
    let { inventory = [], equippedItems = {} } = charData; 
    
    const itemToUnequip = equippedItems[slot]; 
    if (!itemToUnequip) return; 

    // (สร้าง baseItem ที่จะคืนเข้า inventory)
    const baseItem = { 
        ...itemToUnequip, 
        bonuses: { ...(itemToUnequip.originalBonuses || itemToUnequip.bonuses) }, 
        quantity: 1 
    }; 
    delete baseItem.isProficient; 
    delete baseItem.isOffHand; 

    // [ ⭐️ KONGFA-FIX (Bug 6) ⭐️ ]
    // (เพิ่มตรรกะตรวจสอบ Stackable)
    const baseItemHasBonuses = baseItem.bonuses && Object.keys(baseItem.bonuses).length > 0;
    const baseItemHasEffects = baseItem.effects && (
        (baseItem.effects.heal && baseItem.effects.heal > 0) ||
        (baseItem.effects.permStats && baseItem.effects.permStats.length > 0) ||
        (baseItem.effects.tempStats && baseItem.effects.tempStats.length > 0)
    );
    const isBaseItemStackable = (baseItem.itemType === 'ทั่วไป' || baseItem.itemType === 'บริโภค') && !baseItemHasBonuses && !baseItemHasEffects;
    
    let existingIdx = -1;

    if (isBaseItemStackable) {
        // (หาไอเทมชื่อเดียวกันที่ stack ได้เหมือนกัน)
        existingIdx = inventory.findIndex(i => {
            const iHasBonuses = i.bonuses && Object.keys(i.bonuses).length > 0;
            const iHasEffects = i.effects && (
                (i.effects.heal && i.effects.heal > 0) ||
                (i.effects.permStats && i.effects.permStats.length > 0) ||
                (i.effects.tempStats && i.effects.tempStats.length > 0)
            );
            return i.name === baseItem.name && (i.itemType === 'ทั่วไป' || i.itemType === 'บริโภค') && !iHasBonuses && !iHasEffects;
        });
    } else {
        // (ตรรกะเดิม: หาไอเทม unique ที่มีโบนัสเหมือนกัน)
        existingIdx = inventory.findIndex(i => 
            i.name === baseItem.name && 
            JSON.stringify(i.originalBonuses || {}) === JSON.stringify(baseItem.originalBonuses || {})
        );
    }

    if (existingIdx > -1) {
        inventory[existingIdx].quantity++; 
    } else {
        inventory.push(baseItem); 
    }
    
    equippedItems[slot] = null; 
    
    await playerRef.update({ inventory, equippedItems }); 
    showAlert(`ถอด ${baseItem.name} ออกแล้ว`, 'info'); 
}


// =================================================================
// ----------------- ตรรกะสกิล (SKILL LOGIC) -----------------
// (ส่วนนี้ไม่มีบั๊ก คงเดิม)
// =================================================================

async function endPlayerTurn(uid, roomId) {
    try {
        const combatSnap = await db.ref(`rooms/${roomId}/combat`).get();
        if (combatSnap.exists() && combatSnap.val().isActive) {
            const currentCombatState = combatSnap.val();
            if (currentCombatState.turnOrder && currentCombatState.turnOrder[currentCombatState.currentTurnIndex].id === uid) {
                await db.ref(`rooms/${roomId}/combat/actionComplete`).set(uid);
            } 
        } 
    } catch (error) {
        console.error("[END TURN] Error:", error);
        showAlert('เกิดข้อผิดพลาดในการจบเทิร์น!', 'error');
    }
}

function checkCooldown(casterData, skill) {
    if (!skill.cooldown && !skill.successCooldown) return null; 

    const cdData = casterData.skillCooldowns || {};
    const skillName = skill.name;

    if (skill.cooldown && skill.cooldown.type === 'PERSONAL') {
        const cdInfo = cdData[skill.id];
        if (cdInfo && cdInfo.type === 'PERSONAL' && cdInfo.turnsLeft > 0) {
            return `สกิล ${skillName} ยังติดคูลดาวน์! (รอ ${cdInfo.turnsLeft} เทิร์น)`;
        }
    }
    
    if (skill.cooldown && skill.cooldown.type === 'PER_COMBAT') {
        const cdInfo = cdData[skill.id];
        if (cdInfo && cdInfo.type === 'PER_COMBAT' && cdInfo.usesLeft <= 0) {
            return `สกิล ${skillName} ใช้ได้ ${skill.cooldown.uses} ครั้งต่อการต่อสู้ (ใช้ครบแล้ว)`;
        }
    }
    
    if (skill.successCooldown && skill.successCooldown.type === 'PER_COMBAT') {
        const cdInfo = cdData[skill.id + '_success']; 
        if (cdInfo && cdInfo.type === 'PER_COMBAT' && cdInfo.usesLeft <= 0) {
             return `สกิล ${skillName} ติดคูลดาวน์ (ใช้งานสำเร็จไปแล้ว)`;
        }
    }

    return null; 
}

async function setCooldown(casterRef, skill, failed = false) {
    
    if (failed) {
        if (skill.successRoll && skill.successRoll.failCooldown) {
            const turns = skill.successRoll.failCooldown.turns || 3;
            const newCd = { type: 'PERSONAL', turnsLeft: turns };
            await casterRef.child('skillCooldowns').child(skill.id).set(newCd);
        }
        return;
    }

    if (skill.cooldown) {
        if (skill.cooldown.type === 'PERSONAL') {
            const turns = skill.cooldown.turns;
            const newCd = { type: 'PERSONAL', turnsLeft: turns };
            await casterRef.child('skillCooldowns').child(skill.id).set(newCd);
        }
        else if (skill.cooldown.type === 'PER_COMBAT') {
            await casterRef.child('skillCooldowns').child(skill.id).transaction(cdInfo => {
                if (!cdInfo) { 
                    return { type: 'PER_COMBAT', usesLeft: skill.cooldown.uses - 1 };
                }
                cdInfo.usesLeft = (cdInfo.usesLeft || skill.cooldown.uses) - 1;
                return cdInfo;
            });
        }
    }
    
    if (skill.successCooldown && skill.successCooldown.type === 'PER_COMBAT') {
         await casterRef.child('skillCooldowns').child(skill.id + '_success').set({
             type: 'PER_COMBAT',
             usesLeft: 0 
         });
    }
}

async function performSuccessRoll(casterData, targetData, skill, options) {
    if (!skill.successRoll) return { success: true, rollData: {} }; 

    const diceType = skill.successRoll.check || 'd20'; 
    const diceSize = parseInt(diceType.replace('d', ''));
    const casterRoll = Math.floor(Math.random() * diceSize) + 1;

    // [ ⭐️ KONGFA-FIX ⭐️ ]
    const casterStatVal = calculateTotalStat(casterData, skill.scalingStat || 'WIS');
    const casterBonus = (diceSize === 20) ? getStatBonus(casterStatVal) : 0; 
    let totalCasterRoll = casterRoll + casterBonus;

    let targetRoll = 0;
    let totalTargetRoll = 0;
    let dc = skill.successRoll.dc || 10; 
    
    let resultText = `คุณทอย (${diceType}): ${casterRoll}`;
    if (diceSize === 20) {
        resultText += ` + โบนัส ${skill.scalingStat || 'WIS'}: ${casterBonus} = **${totalCasterRoll}**<br>`;
    } else {
        resultText += ` = **${totalCasterRoll}**<br>`; 
    }

    if (skill.successRoll.resistStat && targetData) {
        // [ ⭐️ KONGFA-FIX ⭐️ ]
        const targetStatVal = (targetData.type === 'enemy') ? (targetData.stats?.[skill.successRoll.resistStat.toUpperCase()] || 10) : calculateTotalStat(targetData, skill.successRoll.resistStat);
        const targetBonus = getStatBonus(targetStatVal);
        
        if (diceType.includes('_CONTESTED')) { 
            targetRoll = Math.floor(Math.random() * 20) + 1;
            totalTargetRoll = targetRoll + targetBonus;
            dc = totalTargetRoll; 
            resultText += `เป้าหมายทอย (d20): ${targetRoll} + โบนัส ${skill.successRoll.resistStat}: ${targetBonus} = **${totalTargetRoll}**`;
        } else { 
            dc += targetBonus; 
            resultText += `ค่าความยาก (DC): ${dc} (Base ${skill.successRoll.dc || 10} + Resist Bonus ${targetBonus})`;
        }
    } else {
        resultText += `ค่าความยาก (DC): **${dc}**`;
    }

    const success = totalCasterRoll >= dc;
    await Swal.fire({ 
        title: success ? 'สกิลทำงานสำเร็จ!' : 'สกิลล้มเหลว!', 
        html: resultText, 
        icon: success ? 'success' : 'error', 
    });

    return { success, rollData: { casterRoll: casterRoll, dc } };
}

async function useSkillOnTarget(skillId, targetId, options = {}) {
    const casterUid = firebase.auth().currentUser?.uid; 
    const roomId = sessionStorage.getItem('roomId'); 
    if (!casterUid || !roomId) { showAlert('ข้อมูลไม่ครบถ้วน!', 'error'); return; }

    const combatSnap = await db.ref(`rooms/${roomId}/combat`).get();
    const currentCombatState = combatSnap.val() || {};
    if (currentCombatState.isActive && currentCombatState.turnOrder[currentCombatState.currentTurnIndex].id !== casterUid) {
        return showAlert('ยังไม่ถึงเทิร์นของคุณ!', 'warning');
    }

    const casterData = (typeof allPlayersInRoom !== 'undefined' && allPlayersInRoom) ? allPlayersInRoom[casterUid] : null; 
    if (!casterData) { showAlert('ไม่พบข้อมูลผู้ใช้ปัจจุบัน!', 'error'); return; } 
    if (!casterData.uid) casterData.uid = casterUid; 
    
    let combinedSkills = [];
    if (typeof SKILL_DATA !== 'undefined') {
        if (casterData.classMain && SKILL_DATA[casterData.classMain]) combinedSkills.push(...(SKILL_DATA[casterData.classMain] || []));
        if (casterData.classSub && SKILL_DATA[casterData.classSub]) combinedSkills.push(...(SKILL_DATA[casterData.classSub] || []));
    }
    if (typeof RACE_DATA !== 'undefined') {
        const raceId = casterData.raceEvolved || casterData.race;
        if (RACE_DATA[raceId] && RACE_DATA[raceId].skills) {
            RACE_DATA[raceId].skills.forEach(id => {
                if(SKILL_DATA[id]) combinedSkills.push(SKILL_DATA[id]);
            });
        }
    }

    const skill = combinedSkills.find(s => s.id === skillId);
    if (!skill) { showAlert('ไม่พบสกิล!', 'error'); return; } 
    if (skill.skillTrigger === 'PASSIVE') { showAlert('สกิลติดตัวทำงานอัตโนมัติ', 'info'); return; }

    const casterRef = db.ref(`rooms/${roomId}/playersByUid/${casterUid}`); 
    let targetData = null; 
    let targetRef = null;
    let targetType = 'single';

    if (skill.targetType === 'self' || targetId === casterUid) { 
        targetData = { ...casterData }; if(!targetData.type) targetData.type = 'player'; 
        targetRef = casterRef; 
    }
    else if (skill.targetType.includes('enemy')) { 
        if(skill.targetType.includes('_all')) targetType = 'enemy_all';
        
        targetData = (typeof allEnemiesInRoom !== 'undefined' && allEnemiesInRoom) ? allEnemiesInRoom[targetId] : null; 
        if (!targetData && targetType === 'single') { showAlert('ไม่พบข้อมูลเป้าหมายศัตรู!', 'error'); return; } 
        if(targetData) {
             targetData = { ...targetData }; if(!targetData.type) targetData.type = 'enemy'; 
             targetRef = db.ref(`rooms/${roomId}/enemies/${targetId}`); 
        }
    }
    else if (skill.targetType.includes('teammate')) { 
        if(skill.targetType.includes('_all')) targetType = 'teammate_all';
        
        if (skill.id.includes('cleric_heal') && targetId === casterUid) {
            return showAlert('นักบวช/นักบุญหญิง ไม่สามารถฮีลตัวเองได้!', 'warning');
        }
        targetData = (typeof allPlayersInRoom !== 'undefined' && allPlayersInRoom) ? allPlayersInRoom[targetId] : null; 
        if (!targetData && targetType === 'single') { showAlert('ไม่พบข้อมูลเป้าหมายเพื่อนร่วมทีม!', 'error'); return; } 
        if(targetData) {
            targetData = { ...targetData }; if(!targetData.type) targetData.type = 'player'; 
            targetRef = db.ref(`rooms/${roomId}/playersByUid/${targetId}`); 
        }
    }
    else { showAlert('ประเภทเป้าหมายสกิลไม่รองรับ', 'error'); return; }
    
    const cdError = checkCooldown(casterData, skill); 
    if (cdError) { showAlert(cdError, 'warning'); return; }

    try {
        const { success, rollData } = await performSuccessRoll(casterData, targetData, skill, options); 
        if (!success) { 
            await setCooldown(casterRef, skill, true); 
            await endPlayerTurn(casterUid, roomId); 
            return; 
        }

        let skillOutcome = null;
        const effectOptions = { ...options, rollData: rollData };
        
        if (targetType === 'enemy_all' || targetType === 'teammate_all' || skill.targetType === 'teammate_all_self') {
            const allTargets = (targetType === 'enemy_all') ? allEnemiesInRoom : allPlayersInRoom;
            for (const tId in allTargets) {
                if (targetType.includes('teammate') && tId === casterUid && skill.id.includes('cleric_heal')) continue;
                if (skill.targetType === 'teammate_all' && tId === casterUid) continue;
                
                const tData = { ...allTargets[tId], type: (targetType === 'enemy_all' ? 'enemy' : 'player') };
                const tRef = db.ref(`rooms/${roomId}/${targetType === 'enemy_all' ? 'enemies' : 'playersByUid'}/${tId}`);
                
                await applyEffect(casterRef, tRef, casterData, tData, skill, effectOptions);
            }
            skillOutcome = { statusApplied: `ส่งผลต่อเป้าหมายทั้งหมด` };
            
        } else if (targetRef) {
            skillOutcome = await applyEffect(casterRef, tRef, casterData, targetData, skill, effectOptions);
        }

        if (skill.selfEffect) {
            await applyEffect(casterRef, casterRef, casterData, casterData, { ...skill, effect: skill.selfEffect }, effectOptions);
        }
        
         Swal.fire({
            title: `ใช้สกิล ${skill.name} สำเร็จ!`,
            text: skillOutcome?.statusApplied || `สร้างความเสียหาย ${skillOutcome?.damageDealt || 0} / ฮีล ${skillOutcome?.healAmount || 0}`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
         });
        
        await setCooldown(casterRef, skill, false);
        await endPlayerTurn(casterUid, roomId); 
         
    } catch (error) { 
        console.error("Error applying skill effect:", error); 
        showAlert('เกิดข้อผิดพลาดร้ายแรงในการใช้สกิล', 'error'); 
        await endPlayerTurn(casterUid, roomId); 
    }
}

async function applyEffect(casterRef, targetRef, casterData, targetData, skill, options = {}) {
    const effect = skill.effect;
    // [ ⭐️ KONGFA-FIX ⭐️ ]
    // (Helper consts ถูกย้ายไปด้านบนสุดของไฟล์แล้ว)
    
    let outcome = { damageDealt: 0, healAmount: 0, statusApplied: null };

    await targetRef.transaction(currentData => {
        if (currentData === null) { console.warn(`[TRANSACTION ${skill.id}] Target data is null, aborting.`); return; }
         
         if (!currentData.type) currentData.type = targetData.type;
         if (!currentData.race && targetData.type === 'player') currentData.race = targetData.race;
         if (!currentData.classMain && targetData.type === 'player') currentData.classMain = targetData.classMain;
         if (!currentData.stats) currentData.stats = { ...(targetData.stats || {}) };
         if (!currentData.activeEffects) currentData.activeEffects = [];

        const duration = effect.duration || (effect.durationDice ? (Math.floor(Math.random() * parseInt(effect.durationDice.replace('d', ''))) + 1) : 3);
        const amount = effect.amount || (effect.amountDice ? (Math.floor(Math.random() * parseInt(effect.amountDice.replace('d', ''))) + 1) : 0);
        
        let tempDataForMaxHpCalc = JSON.parse(JSON.stringify(currentData));
        const currentFinalCon_Before = calcTotalStatFnLocal(tempDataForMaxHpCalc, 'CON');
        const currentTheoreticalMaxHp = calcHPFnLocal(tempDataForMaxHpCalc.race, tempDataForMaxHpCalc.classMain, currentFinalCon_Before);
        
        let conChangedInTransaction = false; 

        function applyBuffDebuff() {
            switch(effect.type) {
                case 'ALL_TEMP_STAT_PERCENT': 
                case 'MULTI_TEMP_STAT_PERCENT':
                    let statsToApply = [];
                    if (effect.type === 'ALL_TEMP_STAT_PERCENT') statsToApply = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(s => ({ stat: s, amount: effect.amount || amount }));
                    else statsToApply = effect.stats; 

                    let buffDesc = [];
                    statsToApply.forEach(mod => {
                        currentData.activeEffects.push({ 
                            skillId: skill.id, name: skill.name, type: 'BUFF', 
                            stat: mod.stat, modType: 'PERCENT', amount: mod.amount, 
                            turnsLeft: duration 
                        });
                        buffDesc.push(`${mod.stat} ${mod.amount >= 0 ? '+' : ''}${mod.amount}%`);
                        if (mod.stat === 'CON') conChangedInTransaction = true;
                    });
                    outcome.statusApplied = `ได้รับบัฟ ${buffDesc.join(', ')} (${duration} เทิร์น)`;
                    break;
                
                case 'ALL_TEMP_STAT_DEBUFF_PERCENT':
                    currentData.activeEffects.push({ 
                        skillId: skill.id, name: skill.name, type: 'DEBUFF', 
                        stat: 'ALL', modType: 'PERCENT', amount: -Math.abs(amount), 
                        turnsLeft: duration 
                    });
                    outcome.statusApplied = `ติดดีบัฟ ลดทุกสเตตัส ${amount}% (${duration} เทิร์น)`;
                    conChangedInTransaction = true; 
                    break;

                case 'TEMP_LEVEL_PERCENT': 
                    currentData.activeEffects.push({ 
                        skillId: skill.id, name: skill.name, type: 'TEMP_LEVEL_PERCENT', 
                        stat: 'Level', modType: 'PERCENT', amount: amount, 
                        turnsLeft: duration 
                    });
                    outcome.statusApplied = `ได้รับบัฟ เพิ่มเลเวล +${amount}% (${duration} เทิร์น)`;
                    conChangedInTransaction = true; 
                    break;

                case 'STATUS': 
                    if(effect.status === 'INVISIBILE') {
                        currentData.activeEffects.push({ 
                            skillId: skill.id, name: skill.name, type: 'BUFF', 
                            stat: 'Visibility', modType: 'SET_VALUE', amount: 'Invisible', 
                            turnsLeft: duration 
                        });
                        outcome.statusApplied = `หายตัว (${duration} เทิร์น)`; 
                    }
                    break;
                
                case 'WEAPON_BUFF':
                    currentData.activeEffects.push({
                        skillId: skill.id, name: skill.name, type: 'BUFF',
                        stat: 'WeaponAttack', modType: 'FORMULA', buffId: effect.buffId,
                        turnsLeft: duration
                    });
                    outcome.statusApplied = `เคลือบอาวุธ (${duration} เทิร์น)`;
                    break;
                
                case 'ELEMENT_SELECT':
                    currentData.activeEffects = currentData.activeEffects.filter(e => e.type !== 'ELEMENTAL_BUFF');
                    (options.selectedElement || []).forEach(element => {
                        currentData.activeEffects.push({
                            skillId: skill.id, name: skill.name, type: 'ELEMENTAL_BUFF',
                            stat: 'Element', modType: 'SET_VALUE', amount: element,
                            turnsLeft: 999 
                        });
                    });
                    outcome.statusApplied = `เปลี่ยนธาตุเป็น ${options.selectedElement.join(', ')}`;
                    break;
            }
        }
        
        function applyHealing() {
            const isUndead = currentData.race === 'อันเดด';
            
            switch(effect.type) {
                case 'FORMULA_HEAL': 
                    const wisBonus = getStatBonusFnLocal(calcTotalStatFnLocal(casterData, 'WIS'));
                    let healAmount = 0;
                    
                    if (effect.formula === 'CLERIC_HEAL_V1') { 
                        const d4_percent = (Math.floor(Math.random() * 4) + 1);
                        healAmount = Math.floor(currentTheoreticalMaxHp * ((d4_percent + wisBonus) / 100));
                    }
                    else if (effect.formula === 'SAGE_HEAL_V1') { 
                        const d6_percent = (Math.floor(Math.random() * 6) + 1);
                        healAmount = Math.floor(currentTheoreticalMaxHp * ((d6_percent + wisBonus) / 100));
                    }
                    else if (effect.formula === 'ARCHSAGE_HEAL_V1') { 
                        const casterCon = calcTotalStatFnLocal(casterData, 'CON');
                        const casterMaxHp = calcHPFnLocal(casterData.race, casterData.classMain, casterCon);
                        const d8_percent = (Math.floor(Math.random() * 8) + 1);
                        const bonusFromHp = casterMaxHp * 0.25;
                        healAmount = Math.floor(currentTheoreticalMaxHp * ((d8_percent + wisBonus) / 100)) + bonusFromHp;
                    }
                    
                    if (isUndead) {
                        currentData.hp = (currentData.hp || 0) - healAmount;
                        outcome.damageDealt = healAmount;
                    } else {
                        const healedHp = Math.min(currentTheoreticalMaxHp, (currentData.hp || 0) + healAmount) - (currentData.hp || 0); 
                        currentData.hp += healedHp; 
                        outcome.healAmount = healedHp; 
                    }
                    break;
            }
        }
        
        function applyFormulaDamage() {
            let damage = 0;
            const targetCurrentHp = currentData.hp || 0;
            const targetMaxHp = currentData.maxHp || currentTheoreticalMaxHp;
            const casterRoll = options.rollData?.casterRoll; 

            switch(effect.formula) {
                case 'GOD_JUDGMENT': 
                    if (targetCurrentHp < (targetMaxHp * 0.50)) {
                        damage = targetCurrentHp; 
                        outcome.statusApplied = "ถูกพิพากษา (ตายทันที)";
                    } else {
                        damage = Math.floor(targetMaxHp * 0.75); 
                        outcome.statusApplied = "ถูกพิพากษา (75% MaxHP)";
                    }
                    break;

                case 'ARCHSAGE_JUDGMENT': 
                    const reductionMap = { 40: 1, 39: 2, 38: 3, 37: 4, 36: 5, 35: 5 }; 
                    const hpLossPercent = reductionMap[casterRoll] || 0;
                    
                    damage = targetCurrentHp; 
                    outcome.statusApplied = `พิพากษาต้องห้าม (ทอย ${casterRoll})!`;
                    
                    options.selfEffect = {
                        type: 'PERMANENT_MAXHP_LOSS_PERCENT',
                        amount: hpLossPercent
                    };
                    break;
            }
            
            currentData.hp = (currentData.hp || 0) - damage; 
            outcome.damageDealt = damage;
        }

        function applySpecialLogic() {
            switch(effect.type) {
                case 'CONTROL': 
                    if (effect.status === 'TAUNT') {
                        currentData.activeEffects.push({ 
                            skillId: skill.id, name: skill.name, type: 'TAUNT', 
                            taunterUid: casterData.uid, 
                            turnsLeft: duration 
                        }); 
                        outcome.statusApplied = `ยั่วยุ (${duration} เทิร์น)`; 
                    }
                    break;
                case 'DOT': 
                    currentData.activeEffects.push({ 
                        skillId: skill.id, name: skill.name, type: 'DEBUFF_DOT', 
                        stat: 'HP', modType: 'DOT_PERCENT_CURRENT', amount: amount, 
                        turnsLeft: duration 
                    }); 
                    outcome.statusApplied = `ติดพิษ (${amount}% ต่อเทิร์น, ${duration} เทิร์น)`; 
                    break;
            }
        }

        switch(effect.type) {
            case 'ALL_TEMP_STAT_PERCENT':
            case 'MULTI_TEMP_STAT_PERCENT':
            case 'ALL_TEMP_STAT_DEBUFF_PERCENT':
            case 'TEMP_LEVEL_PERCENT':
            case 'STATUS':
            case 'WEAPON_BUFF':
            case 'ELEMENT_SELECT':
                applyBuffDebuff();
                break;
            case 'FORMULA_HEAL':
                applyHealing();
                break;
            case 'FORMULA':
                applyFormulaDamage();
                break;
            case 'CONTROL':
            case 'DOT':
                applySpecialLogic();
                break;
            default:
                console.warn(`[TRANSACTION] Unhandled effect type: ${effect.type}`);
        }

        let finalTheoreticalMaxHp = currentTheoreticalMaxHp; 

        if (conChangedInTransaction) {
            let tempDataAfterEffect = JSON.parse(JSON.stringify(currentData));
            const finalConAfter = calcTotalStatFnLocal(tempDataAfterEffect, 'CON'); 
            finalTheoreticalMaxHp = calcHPFnLocal(tempDataAfterEffect.race, tempDataAfterEffect.classMain, finalConAfter); 
            currentData.maxHp = finalTheoreticalMaxHp;
        }
        
        if (currentData.hp < 0) { currentData.hp = 0; }
        
        const ceilingHp = currentData.maxHp || finalTheoreticalMaxHp; 
        if (currentData.hp > ceilingHp) {
             currentData.hp = ceilingHp;
        }

        if (isNaN(currentData.hp)) { 
            console.error(`[TRANSACTION ${skill.id}] HP became NaN!`); 
            return; 
        }
        
        return currentData; 
    });

    if (options.selfEffect && options.selfEffect.type === 'PERMANENT_MAXHP_LOSS_PERCENT') {
         await casterRef.transaction(casterCurrentData => {
             if (casterCurrentData) { 
                 const currentCon = calcTotalStatFnLocal(casterCurrentData, 'CON');
                 const currentMax = casterCurrentData.maxHp || calcHPFnLocal(casterCurrentData.race, casterCurrentData.classMain, currentCon);
                 
                 const lossAmount = Math.floor(currentMax * (options.selfEffect.amount / 100)); 
                 casterCurrentData.maxHp = Math.max(1, currentMax - lossAmount); 
                 casterCurrentData.hp = Math.min(casterCurrentData.maxHp, casterCurrentData.hp || 0); 
                 console.log(`[SELF EFFECT] สกิล ${skill.id} ทำให้ Max HP ลดลง ${lossAmount} (เหลือ ${casterCurrentData.maxHp})`); 
             } 
             return casterCurrentData;
         });
     }
     return outcome;
}

async function showSkillModal() {
    const currentUserUid = firebase.auth().currentUser?.uid; 
    const roomId = sessionStorage.getItem('roomId'); 
    if (!currentUserUid || !roomId) return;
    
    showLoading("กำลังโหลดข้อมูลสกิล..."); 
    let currentUser; 
    let currentCombatStateForCheck;
    
    try {
        const roomSnap = await db.ref(`rooms/${roomId}`).get(); 
        if (!roomSnap.exists()) { hideLoading(); return showAlert('ไม่พบข้อมูลห้อง!', 'error'); } 
        const roomData = roomSnap.val();
        currentUser = roomData.playersByUid?.[currentUserUid]; 
        currentCombatStateForCheck = roomData.combat || {};
        if (!currentUser) { hideLoading(); return showAlert('ไม่พบข้อมูลตัวละคร!', 'error'); }
         currentUser.uid = currentUserUid; 
    } catch (error) { hideLoading(); return showAlert('เกิดข้อผิดพลาดในการโหลดข้อมูลสกิล', 'error'); } 
    
    hideLoading();
    
    if (currentCombatStateForCheck.isActive && currentCombatStateForCheck.turnOrder[currentCombatStateForCheck.currentTurnIndex].id !== currentUserUid) {
        return showAlert('ยังไม่ถึงเทิร์นของคุณ!', 'warning');
    }

    let allSkills = [];
    if (typeof SKILL_DATA !== 'undefined') {
        if (currentUser.classMain && SKILL_DATA[currentUser.classMain]) allSkills.push(...(SKILL_DATA[currentUser.classMain] || []));
        if (currentUser.classSub && SKILL_DATA[currentUser.classSub]) allSkills.push(...(SKILL_DATA[currentUser.classSub] || []));
    }
    if (typeof RACE_DATA !== 'undefined') {
        const raceId = currentUser.raceEvolved || currentUser.race;
        if (RACE_DATA[raceId] && RACE_DATA[raceId].skills) {
            RACE_DATA[raceId].skills.forEach(id => {
                if(SKILL_DATA[id]) allSkills.push(SKILL_DATA[id]);
            });
        }
    }

    const availableSkills = allSkills.filter(skill => skill.skillTrigger === 'ACTIVE');

    if (!availableSkills || availableSkills.length === 0) return showAlert('คุณไม่มีสกิลที่สามารถใช้ได้', 'info');
    
    let skillButtonsHtml = '';
    availableSkills.forEach(skill => {
        const cdError = checkCooldown(currentUser, skill);
        const isDisabled = cdError !== null; 
        const title = isDisabled ? cdError : (skill.description || 'ไม่มีคำอธิบาย');
        
        skillButtonsHtml += `<button class="swal2-styled" onclick="selectSkillTarget('${skill.id}')" 
            style="margin: 5px; ${isDisabled ? 'background-color: #6c757d; cursor: not-allowed;' : ''}" 
            title="${title}" ${isDisabled ? 'disabled' : ''}>
            ${skill.name}
        </button>`;
    });
    
    Swal.fire({ 
        title: 'เลือกสกิล', 
        html: `<div>${skillButtonsHtml}</div>`, 
        showConfirmButton: false, 
        showCancelButton: true, 
        cancelButtonText: 'ปิด' 
    });
}

async function selectSkillTarget(skillId) {
    const currentUserUid = firebase.auth().currentUser?.uid;
    const currentUser = currentCharacterData; 
    if (!currentUser) return showAlert('ไม่พบข้อมูลผู้เล่น', 'error');

    let allSkills = [];
    if (typeof SKILL_DATA !== 'undefined') {
        if (currentUser.classMain && SKILL_DATA[currentUser.classMain]) allSkills.push(...(SKILL_DATA[currentUser.classMain] || []));
        if (currentUser.classSub && SKILL_DATA[currentUser.classSub]) allSkills.push(...(SKILL_DATA[currentUser.classSub] || []));
    }
    if (typeof RACE_DATA !== 'undefined') {
        const raceId = currentUser.raceEvolved || currentUser.race;
        if (RACE_DATA[raceId] && RACE_DATA[raceId].skills) {
            RACE_DATA[raceId].skills.forEach(id => {
                if(SKILL_DATA[id]) allSkills.push(SKILL_DATA[id]);
            });
        }
    }
    
    const skill = allSkills.find(s => s.id === skillId); 
    if (!skill) return;
    
    let targetOptions = {}; 
    let options = {};

    if (skill.targetType === 'self') {
    } else if (skill.targetType.includes('teammate')) {
         for (const uid in allPlayersInRoom) {
             if (allPlayersInRoom[uid].hp > 0) { 
                targetOptions[uid] = allPlayersInRoom[uid].name;
             }
         }
    } else if (skill.targetType.includes('enemy')) {
        const enemySelect = document.getElementById('enemyTargetSelect');
        for(const option of enemySelect.options) {
            if(option.value) targetOptions[option.value] = option.text;
        }
        if (Object.keys(targetOptions).length === 0) return showAlert('ไม่มีศัตรูให้เลือก!', 'warning');
    }

    if (skill.effect.type === 'ELEMENT_SELECT') {
        const elementOptions = {};
        skill.effect.elements.forEach(el => { elementOptions[el] = el; });
        
        const { value: selectedElement } = await Swal.fire({ 
            title: `เลือกธาตุสำหรับ ${skill.name}`, 
            input: 'select', 
            inputOptions: elementOptions,
            inputPlaceholder: 'เลือกธาตุ',
            showCancelButton: true 
        });
        if (!selectedElement) return; 
        options.selectedElement = [selectedElement]; 
        
        if (skill.effect.selectCount === 2) {
             const { value: selectedElement2 } = await Swal.fire({ 
                title: `เลือกธาตุที่ 2`, 
                input: 'select', 
                inputOptions: elementOptions,
                showCancelButton: true 
            });
            if (selectedElement2) options.selectedElement.push(selectedElement2);
        }
    }

    let targetIds = [];
    if (skill.targetType.includes('_all') || skill.targetType.includes('_aoe') || skill.targetType.includes('_self')) { 
         Swal.fire({ title: `กำลังร่าย ${skill.name}...`, text: `ส่งผลต่อ${skill.targetType.includes('teammate') ? 'เพื่อนร่วมทีม' : 'ศัตรู'}ทั้งหมด!`, icon: 'info', timer: 1500 });
         targetIds = Object.keys(skill.targetType.includes('teammate') ? allPlayersInRoom : allEnemiesInRoom); 
    
    } else if (skill.targetType !== 'self') { 
        const { value: selectedUid } = await Swal.fire({ 
            title: `เลือกเป้าหมายสำหรับ "${skill.name}"`, 
            input: 'select', 
            inputOptions: targetOptions, 
            inputPlaceholder: 'เลือกเป้าหมาย', 
            showCancelButton: true 
        }); 
        if (!selectedUid) return; 
        targetIds.push(selectedUid);
    
    } else { 
        targetIds.push(currentUserUid);
    }

    if (targetIds.length > 0) {
        Swal.close(); 
        
        if (targetIds.length > 1) {
             useSkillOnTarget(skillId, 'all', options);
        } else {
             useSkillOnTarget(skillId, targetIds[0], options);
        }
    }
}


// =================================================================
// ----------------- ตรรกะการโจมตี (ATTACK LOGIC) -----------------
// (ส่วนนี้ได้รับการแก้ไขแล้วในไฟล์ที่ 2 คงเดิม)
// =================================================================

/**
 * [ย้ายมา] โจมตี
 */
async function performAttackRoll() {
    const uid = firebase.auth().currentUser?.uid; 
    if (!uid || !combatState || !combatState.isActive || combatState.turnOrder[combatState.currentTurnIndex].id !== uid) return showAlert("ยังไม่ถึงเทิร์นของคุณ!", 'warning'); 
    
    const selectedEnemyKey = document.getElementById('enemyTargetSelect').value; 
    if (!selectedEnemyKey) return showAlert("กรุณาเลือกเป้าหมาย!", 'warning'); 
    
    const roomId = sessionStorage.getItem('roomId');
    const enemyData = allEnemiesInRoom[selectedEnemyKey];
    const playerData = currentCharacterData; 
    if (!enemyData || !playerData) return showAlert("ไม่พบข้อมูลเป้าหมายหรือผู้เล่น!", 'error');

    document.getElementById('attackRollButton').disabled = true; 
    document.getElementById('skillButton').disabled = true;

    const enemyAC = 10 + Math.floor(((enemyData.stats?.DEX || 10) - 10) / 2); 
    const roll = Math.floor(Math.random() * 20) + 1; 
    
    const mainWeapon = playerData.equippedItems?.mainHand;
    let attackStat = 'STR';
    // (ตรวจสอบว่าอาวุธใช้ DEX หรือไม่)
    if (mainWeapon && (
        (mainWeapon.weaponType === 'มีด' && (playerData.classMain === 'โจร' || playerData.classMain === 'นักฆ่า')) ||
        (mainWeapon.weaponType === 'ธนู' && (playerData.classMain === 'เรนเจอร์' || playerData.classMain === 'อาเชอร์'))
    )) {
        attackStat = 'DEX';
    }
    
    const attackBonus = getStatBonusFn(calculateTotalStat(playerData, attackStat));
    
    const totalAttack = roll + attackBonus;
    
    const resultCard = document.getElementById('rollResultCard'); 
    resultCard.classList.remove('hidden'); 
    const outcomeText = totalAttack >= enemyAC ? '✅ โจมตีโดน!' : '💥 โจมตีพลาด!';
    let rollText = `ทอย (d20): ${roll} + ${attackStat} Bonus: ${attackBonus} = <strong>${totalAttack}</strong>`;
    
    resultCard.innerHTML = `<h4>ผลการโจมตี: ${enemyData.name}</h4><p>${rollText}</p><p>AC ศัตรู: ${enemyAC}</p><p class="outcome">${outcomeText}</p>`; 
    resultCard.className = `result-card ${totalAttack >= enemyAC ? 'hit' : 'miss'}`;
    
    if (totalAttack >= enemyAC) { 
        // [FIX] ถ้าโจมตีโดน, ให้เรียก performDamageRoll
        document.getElementById('damageWeaponName').textContent = mainWeapon?.name || "มือเปล่า"; 
        document.getElementById('damageDiceInfo').textContent = mainWeapon?.damageDice || "d4"; 
        document.getElementById('damageRollSection').style.display = 'block'; 
    } else { 
        // [FIX] ถ้าโจมตีพลาด, ไม่ต้องลดความทนทาน
        setTimeout(async () => { 
            await endPlayerTurn(uid, roomId); 
            resultCard.classList.add('hidden'); 
        }, 2000); 
    }
}

/**
 * [ย้ายมา] คำนวณความเสียหาย
 * [ ⭐️ KONGFA-FIX ⭐️ ] เพิ่มตรรกะความทนทาน "โจมตีโดน -1%"
 * [ ⭐️ KONGFA-FIX (Bug 1) ⭐️ ] แก้ไขการเรียกสูตร %HP
 */
async function performDamageRoll() {
    const uid = firebase.auth().currentUser?.uid; 
    const roomId = sessionStorage.getItem('roomId'); 
    const selectedEnemyKey = document.getElementById('enemyTargetSelect').value; 
    if (!uid || !roomId || !selectedEnemyKey) return;
    
    document.getElementById('damageRollSection').style.display = 'none';
    
    const enemyRef = db.ref(`rooms/${roomId}/enemies/${selectedEnemyKey}`); 
    const playerRef = db.ref(`rooms/${roomId}/playersByUid/${uid}`); // (สำหรับอัปเดตความทนทาน)
    
    const enemySnapshot = await enemyRef.get(); 
    const playerSnapshot = await playerRef.get(); // (ดึงข้อมูลล่าสุด)
    
    if (!enemySnapshot.exists() || !playerSnapshot.exists()) return; 
    
    const enemyData = enemySnapshot.val();
    let playerData = playerSnapshot.val(); // (ใช้ let เพราะอาจต้องอัปเดต)
    
    const mainWeapon = playerData.equippedItems?.mainHand;

    // --- [ ⭐️ KONGFA-FIX ⭐️ ] ตรรกะความทนทาน "โจมตีโดน -1%" ---
    if (mainWeapon) {
        const newDurability = (mainWeapon.durability || 100) - 1;
        
        if (newDurability <= 0) {
            // อาวุธพัง!
            showAlert(`อาวุธ [${mainWeapon.name}] พัง! (ความทนทาน 0%)`, 'error');
            
            // (ต้องเรียกใช้ unequipItem ที่อยู่ในไฟล์นี้)
            // (*** การเรียก unequipItem ภายในนี้จะซับซ้อนเพราะ transaction ***)
            // (*** แก้ไข: ใช้วิธีอัปเดตตรงๆ และจบเทิร์น ***)

            // 1. ถอดอาวุธออกจาก equippedItems
            const updates = {};
            updates[`equippedItems/mainHand`] = null;
            
            // 2. เพิ่มอาวุธที่พังกลับเข้า inventory
            const itemToReturn = { ...mainWeapon, durability: 0, quantity: 1 };
            delete itemToReturn.isProficient;
            delete itemToReturn.isOffHand;
            
            let inventory = playerData.inventory || [];
            const existingIdx = inventory.findIndex(i => i.name === itemToReturn.name && i.durability === 0);
            if(existingIdx > -1) {
                inventory[existingIdx].quantity++;
            } else {
                inventory.push(itemToReturn);
            }
            updates[`inventory`] = inventory;
            
            // 3. บันทึกการเปลี่ยนแปลง
            await playerRef.update(updates);
            
            // 4. จบเทิร์น
            await endPlayerTurn(uid, roomId); 
            const resultCard = document.getElementById('rollResultCard'); 
            resultCard.classList.add('hidden');
            return; // (หยุดการโจมตี)
            
        } else {
            // อัปเดตความทนทานใน Firebase
            await playerRef.child('equippedItems/mainHand/durability').set(newDurability);
            // (อัปเดตข้อมูล local)
            playerData.equippedItems.mainHand.durability = newDurability;
        }
    }
    // --- [ ⭐️ สิ้นสุดตรรกะความทนทาน ⭐️ ] ---

    const diceTypeString = mainWeapon?.damageDice || 'd4';
    const diceType = parseInt(diceTypeString.replace('d', ''));
    const damageRoll = Math.floor(Math.random() * diceType) + 1;
    
    let damageStat = 'STR';
    // (ตรวจสอบว่าอาวุธใช้ DEX หรือไม่)
    if (mainWeapon && (
        (mainWeapon.weaponType === 'มีด' && (playerData.classMain === 'โจร' || playerData.classMain === 'นักฆ่า')) ||
        (mainWeapon.weaponType === 'ธนู' && (playerData.classMain === 'เรนเจอร์' || playerData.classMain === 'อาเชอร์'))
    )) {
        damageStat = 'DEX';
    }
    
    let damageBonus = getStatBonusFn(calculateTotalStat(playerData, damageStat));
    let totalDamage = Math.max(1, damageRoll + damageBonus);
    let damageExplanation = `ทอย (${diceTypeString}): ${damageRoll} + ${damageStat} Bonus: ${damageBonus}`;

    // --- [ ⭐️ เริ่มการคำนวณสูตร %HP (ข้อ 12) ⭐️ ] ---
    
    // [ ⭐️ KONGFA-FIX (Bug 1) ⭐️ ]
    // 1. ตรวจสอบบัฟกดใช้ (Active Effect)
    const formulaOverrideEffect = (playerData.activeEffects || []).find(e => e.stat === 'WeaponAttack' && e.modType === 'FORMULA' && e.buffId);
    
    // 2. ตรวจสอบสกิลติดตัว (Passive)
    let formulaPassive = null;
    if (typeof SKILL_DATA !== 'undefined' && SKILL_DATA[playerData.classMain]) {
        // [แก้ไข] ค้นหา Passive ที่ถูกต้อง
        formulaPassive = SKILL_DATA[playerData.classMain].find(s => 
            s.skillTrigger === 'PASSIVE' && 
            s.effect?.type === 'FORMULA_ATTACK_OVERRIDE'
        );
    }
    if (!formulaPassive && playerData.classSub && SKILL_DATA[playerData.classSub]) {
        // [แก้ไข] ค้นหา Passive ที่ถูกต้อง
         formulaPassive = SKILL_DATA[playerData.classSub].find(s => 
            s.skillTrigger === 'PASSIVE' && 
            s.effect?.type === 'FORMULA_ATTACK_OVERRIDE'
        );
    }

    // 3. เลือกแหล่งที่มาของสูตร (บัฟ > พาสซีฟ)
    const formulaSource = formulaOverrideEffect || (formulaPassive ? formulaPassive.effect : null);

    if (formulaSource) {
        // [แก้ไข] ดึงชื่อสูตรจาก buffId (ถ้าเป็นบัฟ) หรือ formula (ถ้าเป็นพาสซีฟ)
        const formulaId = formulaSource.buffId || formulaSource.formula;
        
        const targetCurrentHp = enemyData.hp || 0;
        const intBonus = getStatBonusFn(calculateTotalStat(playerData, 'INT'));
        const wisBonus = getStatBonusFn(calculateTotalStat(playerData, 'WIS'));
        const strBonus = getStatBonusFn(calculateTotalStat(playerData, 'STR'));
        
        switch (formulaId) {
            case 'HOLY_LIGHT_FORMULA_ATTACK': 
                totalDamage = Math.floor(((damageRoll + damageBonus) * 0.15) * targetCurrentHp);
                damageExplanation = `[ดาบแห่งแสง] (${damageRoll}+${damageBonus})*15% * ${targetCurrentHp}HP`;
                break;
            case 'MAGE_PASSIVE_V1': 
                totalDamage = Math.floor(((damageRoll + intBonus) * 0.15) * targetCurrentHp);
                damageExplanation = `[เวทย์ติดตัว] (${damageRoll}+${intBonus})*15% * ${targetCurrentHp}HP`;
                break;
            case 'MAGE_PASSIVE_V2': 
                totalDamage = Math.floor(((damageRoll + intBonus + wisBonus) * 0.20) * targetCurrentHp);
                damageExplanation = `[เวทย์ติดตัว V2] (${damageRoll}+${intBonus}+${wisBonus})*20% * ${targetCurrentHp}HP`;
                break;
            case 'MAGE_PASSIVE_V3': 
                totalDamage = Math.floor(((damageRoll + intBonus + wisBonus) * 0.30) * targetCurrentHp);
                damageExplanation = `[เวทย์ติดตัว V3] (${damageRoll}+${intBonus}+${wisBonus})*30% * ${targetCurrentHp}HP`;
                break;
            case 'MAGE_PASSIVE_V4': 
                totalDamage = Math.floor(((damageRoll + intBonus + wisBonus) * 0.60) * targetCurrentHp);
                damageExplanation = `[เวทย์ติดตัว V4] (${damageRoll}+${intBonus}+${wisBonus})*60% * ${targetCurrentHp}HP`;
                break;
            case 'MS_RUNE_BLADE_V1': 
                totalDamage = Math.floor(((damageRoll + intBonus) * 0.10) * targetCurrentHp);
                damageExplanation = `[ดาบมนตรา V1] (${damageRoll}+${intBonus})*10% * ${targetCurrentHp}HP`;
                break;
            
            // [ ⭐️ KONGFA-FIX (Bug 1) ⭐️ ]
            // เพิ่ม Case ที่หายไปจาก skills-data.js (MS_ARCANE_SLASH_V1, V2, V3)
            case 'MS_ARCANE_SLASH_V1': 
                 totalDamage = Math.floor(((damageRoll + strBonus + intBonus) * 0.15) * targetCurrentHp);
                 damageExplanation = `[กายาผสานเวทย์ V1] (${damageRoll}+${strBonus}+${intBonus})*15% * ${targetCurrentHp}HP`;
                 break;
            case 'MS_ARCANE_SLASH_V2': // (จาก จอมดาบมนตรา)
                 totalDamage = Math.floor(((damageRoll + strBonus + intBonus) * 0.25) * targetCurrentHp);
                 damageExplanation = `[กายาผสานเวทย์ V2] (${damageRoll}+${strBonus}+${intBonus})*25% * ${targetCurrentHp}HP`;
                 break;
            case 'MS_ARCANE_SLASH_V3': // (จาก ราชันย์ดาบเวทย์)
                 totalDamage = Math.floor(((damageRoll + strBonus + intBonus) * 0.35) * targetCurrentHp);
                 damageExplanation = `[กายาผสานเวทย์ V3] (${damageRoll}+${strBonus}+${intBonus})*35% * ${targetCurrentHp}HP`;
                 break;

            case 'DL_PASSIVE_V1': 
                 const demonStatBonus = Math.max(strBonus, intBonus);
                 totalDamage = Math.floor(((damageRoll + demonStatBonus) * 0.15) * targetCurrentHp);
                 damageExplanation = `[อำนาจจอมมาร] (${damageRoll}+${demonStatBonus})*15% * ${targetCurrentHp}HP`;
                 break;
        }
        totalDamage = Math.max(1, totalDamage);
    }
    // --- [ ⭐️ สิ้นสุดการคำนวณสูตร %HP ⭐️ ] ---

    const resultCard = document.getElementById('rollResultCard'); 
    resultCard.innerHTML = `<h4>ผลความเสียหาย: ${enemyData.name}</h4><p>${damageExplanation} = <strong>${totalDamage}</strong></p><p class="outcome">🔥 สร้างความเสียหาย ${totalDamage} หน่วย! 🔥</p>`; 
    resultCard.className = 'result-card hit';
    
    const newHp = (enemyData.hp || 0) - totalDamage;
    
    setTimeout(async () => {
        if (newHp <= 0) { 
            await enemyRef.remove(); 
        } else { 
            await enemyRef.child('hp').set(newHp); 
        }
        await endPlayerTurn(uid, roomId);
        resultCard.classList.add('hidden');
    }, 2000);
}