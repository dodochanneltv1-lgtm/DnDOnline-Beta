/*
* =================================================================
* Javascript/skills-data.js (v3.1 - อัปเกรดโบนัสอาชีพ)
* -----------------------------------------------------------------
* นี่คือฐานข้อมูล "กฎ" ของเกมทั้งหมด (Rulebook)
* ไฟล์นี้ถูกยืนยันความถูกต้องตามข้อกำหนด V3 (ข้อ 10, 11, 12)
*
* [อัปเดต] เพิ่มโบนัสสเตตัส (bonuses) ให้กับทุกอาชีพใน CLASS_DATA
*
* ประกอบด้วย:
* 1. RACE_DATA (ข้อ 11: ฐานข้อมูลเผ่าพันธุ์ใหม่)
* 2. CLASS_DATA (ข้อ 10: ฐานข้อมูลสายอาชีพใหม่ + โบนัสสเตตัส)
* 3. CLASS_WEAPON_PROFICIENCY (ข้อ 5: ความชำนาญอาวุธ)
* 4. SKILL_DATA (ข้อ 12: ฐานข้อมูลสกิลใหม่ทั้งหมด)
* 5. ELEMENT_REACTIONS (ข้อ 12: ปฏิกิริยาธาตุ)
* =================================================================
*/

/**
 * -----------------------------------------------------------------
 * 1. ฐานข้อมูลเผ่าพันธุ์ (ข้อ 11)
 * -----------------------------------------------------------------
 * เก็บโบนัส, สกิลติดตัว, และเงื่อนไขการวิวัฒนาการ
 */
const RACE_DATA = {
    // --- เผ่าพันธุ์พื้นฐาน ---
    'มนุษย์': {
        name: 'มนุษย์',
        bonuses: { STR: 2, DEX: 2, CON: 2, INT: 2, WIS: 2, CHA: 2 },
        passives: [],
        evolution: { level: 90, to: 'ครึ่งเทพ' }
    },
    'เอลฟ์': {
        name: 'เอลฟ์',
        bonuses: { DEX: 4, WIS: 3 },
        passives: [
            { id: 'elf_passive_1', name: 'พรแห่งพงไพร', description: 'เพิ่มประสิทธิภาพของเวทมนตร์ธาตุ [ไม้] และ [ลม] 15%' },
            { id: 'elf_passive_2', name: 'สายตาเหยี่ยว', description: 'เพิ่มความแม่นยำ (Hit Rate) เมื่อใช้อาวุธประเภทธนู 10%' }
        ]
    },
    'ดาร์คเอลฟ์': {
        name: 'ดาร์คเอลฟ์',
        bonuses: { DEX: 4, INT: 3 },
        passives: [
            { id: 'darkelf_passive_1', name: 'อำพรางในเงา', description: 'เพิ่มประสิทธิภาพของสกิลลอบเร้น (Stealth) 20%' },
            { id: 'darkelf_passive_2', name: 'ต้านทานความมืด', description: 'ลดความเสียหายจากธาตุมืด 25%' }
        ]
    },
    'คนแคระ': {
        name: 'คนแคระ',
        bonuses: { CON: 5, STR: 3, DEX: -2 },
        passives: [
            { id: 'dwarf_passive_1', name: 'ผิวหนังแกร่ง', description: 'ลดความเสียหายกายภาพ (Physical Damage) ที่ได้รับ 10%' },
            { id: 'dwarf_passive_2', name: 'ต้านทานพิษ', description: 'ต้านทานสถานะ [พิษ] 50%' }
        ]
    },
    'ครึ่งสัตว์': {
        name: 'ครึ่งสัตว์',
        bonuses: { DEX: 3, CHA: 2, STR: 1 },
        passives: [
            { id: 'beastkin_passive_1', name: 'ประสาทสัมผัสสัตว์', description: 'เพิ่มอัตราการหลบหลีก (Evasion) 5% และมีโอกาส 15% ที่จะตรวจจับศัตรูที่ซ่อนตัวหรือกับดักได้' }
        ]
    },
    'มนุษย์สัตว์': {
        name: 'มนุษย์สัตว์',
        bonuses: { STR: 5, DEX: 3, INT: -2 },
        passives: [
            { id: 'therian_passive_1', name: 'กรงเล็บสังหาร', description: 'สามารถต่อสู้มือเปล่าได้ โดยการโจมตีมือเปล่า (Unarmed) จะได้รับโบนัสความเสียหายจาก STR x1.5' }
        ],
        skills: ['therian_roar'] // ID สกิลกดใช้
    },
    'แวมไพร์': {
        name: 'แวมไพร์',
        bonuses: { INT: 4, STR: 3, DEX: 3 },
        passives: [
            { id: 'vampire_passive_1', name: 'ดูดเลือด', description: 'ฮีลตนเอง 10% ของความเสียหายทั้งหมดที่สร้าง' },
            { id: 'vampire_passive_2', name: 'จุดอ่อนแสง', description: 'ได้รับความเสียหายจากธาตุ [แสง] หรือ [ศักดิ์สิทธิ์] แรงขึ้น 30%' }
        ]
    },
    'ภูติ': {
        name: 'ภูติ',
        bonuses: { INT: 5, DEX: 5, STR: -4, CON: -3 },
        passives: [
            { id: 'fairy_passive_1', name: 'ร่างเล็กล่องลอย', description: 'มีอัตราหลบหลีก (Evasion) 20% ต่อการโจมตีกายภาพ' },
            { id: 'fairy_passive_2', name: 'พรแห่งภูติ', description: 'สกิลบัฟ (Buff) ที่ใช้มีประสิทธิภาพเพิ่มขึ้น 10%' }
        ]
    },
    'นางฟ้า': {
        name: 'นางฟ้า',
        restrictions: { gender: 'หญิง' },
        bonuses: { WIS: 5, INT: 3, CHA: 2 },
        passives: [
            { id: 'angel_passive_1', name: 'ปีกศักดิ์สิทธิ์', description: 'ต้านทานเวทย์ศักดิ์สิทธิ์ 50% และต้านทานสถานะ [คำสาป]' },
            { id: 'angel_passive_2', name: 'พรจากสวรรค์', description: 'เพิ่มประสิทธิภาพของเวทย์ฮีล (Healing Magic) 20%' }
        ]
    },
    'ปีกสวรรค์ (ขาว)': {
        name: 'ปีกสวรรค์ (ขาว)',
        bonuses: { DEX: 3, WIS: 2, CHA: 2 },
        passives: [
            { id: 'skyfolk_w_passive_1', name: 'บินร่อน', description: 'สามารถบินได้ (หลบการโจมตี/กับดักบนพื้น) เพิ่มอัตราหลบหลีก 10%' }
        ]
    },
    'ปีกสวรรค์ (ดำ)': {
        name: 'ปีกสวรรค์ (ดำ)',
        bonuses: { STR: 3, DEX: 2, INT: 2 },
        passives: [
            { id: 'skyfolk_b_passive_1', name: 'จู่โจมดุจเหยี่ยว', description: 'การโจมตีแรกในการต่อสู้ (First Strike) จะแรงขึ้น 25%' }
        ]
    },
    'มาร': {
        name: 'มาร',
        bonuses: { INT: 5, STR: 5, WIS: -3 },
        passives: [
            { id: 'demon_passive_1', name: 'สัญญาแห่งความมืด', description: 'เพิ่มความเสียหายธาตุมืด (Dark Damage) 20%' },
            { id: 'demon_passive_2', name: 'ต้านทานความกลัว', description: 'ต้านทานสถานะ [หวาดกลัว] 100%' }
        ]
    },
    'โกเลม': {
        name: 'โกเลม',
        bonuses: { CON: 6, STR: 4, DEX: -4 },
        restrictions: { noMagicClass: true, noInvestStats: ['INT', 'WIS'] },
        passives: [
            { id: 'golem_passive_1', name: 'ร่างศิลา', description: 'ลดความเสียหายกายภาพ 25% แต่ไม่สามารถหลบหลีกได้ (Evasion = 0)' },
            { id: 'golem_passive_2', name: 'ต้านทานเวทย์', description: 'ลดความเสียหายเวทมนตร์ 15%' }
        ]
    },
    'อันเดด': {
        name: 'อันเดด',
        bonuses: { CON: 4, INT: 3 },
        restrictions: { cannotBeHealed: true }, // ไม่สามารถรับฮีล (ยกเว้นฮีลตัวเอง)
        passives: [
            { id: 'undead_passive_1', name: 'ฟื้นฟูต้องสาป', description: 'ฟื้นฟู HP 2% ทุกเทิร์น' },
            { id: 'undead_passive_2', name: 'วิญญาณอมตะ', description: 'สามารถคืนชีพได้ 5 ครั้ง (ต่อการต่อสู้ 1 ครั้ง)' }
        ]
    },
    'ครึ่งมังกร': {
        name: 'ครึ่งมังกร',
        bonuses: { STR: 3, CON: 3, INT: 2 },
        passives: [
            { id: 'dragonkin_passive_1', name: 'เกล็ดมังกร', description: 'ลดความเสียหายกายภาพ/เวทมนตร์ 10%' },
            { id: 'dragonkin_passive_2', name: 'ต้านทานธาตุ', description: 'ต้านทานธาตุ (ไฟ, น้ำแข็ง, สายฟ้า) 15%' }
        ],
        evolution: { level: 75, to: 'มังกร' }
    },

    // --- เผ่าพันธุ์วิวัฒนาการ ---
    'มังกร': {
        name: 'มังกร',
        bonuses: { STR: 10, CON: 10, INT: 8, WIS: 8 }, // แทนที่โบนัสเก่า
        passives: [
            { id: 'dragon_passive_1', name: 'เกล็ดมังกรโบราณ', description: 'ลดความเสียหายทั้งหมด 30%' },
            { id: 'dragon_passive_2', name: 'พลังแห่งธาตุ', description: 'ต้านทานธาตุ (ไฟ, น้ำแข็ง, สายฟ้า) 50%' }
        ],
        skills: ['dragon_breath']
    },
    'ครึ่งเทพ': {
        name: 'ครึ่งเทพ',
        bonuses: { STR: 8, DEX: 8, CON: 8, INT: 8, WIS: 8, CHA: 8 }, // แทนที่โบนัสเก่า
        passives: [
            { id: 'halfgod_passive_1', name: 'สายเลือดเทวะ', description: 'ต้านทานสถานะผิดปกติ 50%, เพิ่มความเสียหายธาตุ [แสง] 25%' }
        ],
        evolution: { level: 100, to: 'พระเจ้า' }
    },
    'พระเจ้า': {
        name: 'พระเจ้า',
        bonuses: { STR: 15, DEX: 15, CON: 15, INT: 15, WIS: 15, CHA: 15 }, // แทนที่โบนัสเก่า
        passives: [
            { id: 'god_passive_1', name: 'อำนาจแห่งพระเจ้า', description: 'ต้านทานสถานะผิดปกติและดีบัฟทั้งหมด 100%' },
            { id: 'god_passive_2', name: 'สัจธรรม', description: 'การโจมตีทั้งหมด (กายภาพ/เวทย์) จะสร้างความเสียหายเป็น (True Damage) (ข้ามผ่านการป้องกัน/ต้านทาน)' }
        ],
        skills: ['god_judgment']
    }
};

/**
 * -----------------------------------------------------------------
 * 2. ฐานข้อมูลสายอาชีพ (ข้อ 10)
 * [อัปเดต v3.1] เพิ่มโบนัสสเตตัส (bonuses)
 * -----------------------------------------------------------------
 * โบนัสเหล่านี้จะ "ทับที่" โบนัสของเทียร์ก่อนหน้า ไม่ได้บวกรวมกัน
 */
const CLASS_DATA = {
    // --- อาชีพหลัก T1 (Main) ---
    'นักรบ': {
        name: 'นักรบ',
        tier: 1,
        bonuses: { STR: 3, CON: 2 }, // (รวม +5)
        progression: { level: 20, to: 'อัศวิน' },
        subClassUnlock: 10
    },
    'แทงค์': {
        name: 'แทงค์',
        tier: 1,
        bonuses: { CON: 4, STR: 1 }, // (รวม +5)
        progression: { level: 20, to: 'Tank Master' },
        subClassUnlock: 10
    },
    'นักเวท': {
        name: 'นักเวท',
        tier: 1,
        bonuses: { INT: 4, WIS: 1 }, // (รวม +5)
        progression: { level: 20, to: 'จอมเวท' },
        subClassUnlock: 10
    },
    'นักบวช': {
        name: 'นักบวช',
        tier: 1,
        bonuses: { WIS: 4, CON: 1 }, // (รวม +5)
        progression: {
            level: 20,
            to: ['นักปราชญ์', 'นักบุญหญิง'],
            choiceCondition: {
                'นักบุญหญิง': { gender: 'หญิง' },
                'นักปราชญ์': { gender: ['ชาย', 'หญิง'] }
            }
        },
        subClassUnlock: 10
    },
    'โจร': {
        name: 'โจร',
        tier: 1,
        bonuses: { DEX: 4, STR: 1 }, // (รวม +5)
        progression: { level: 20, to: 'นักฆ่า' },
        subClassUnlock: 10
    },
    'เรนเจอร์': {
        name: 'เรนเจอร์',
        tier: 1,
        bonuses: { DEX: 3, STR: 2 }, // (รวม +5)
        progression: { level: 20, to: 'อาเชอร์' },
        subClassUnlock: 10
    },
    'พ่อค้า': {
        name: 'พ่อค้า',
        tier: 1,
        bonuses: { CHA: 3, INT: 2 }, // (รวม +5)
        progression: { level: 20, to: 'นักปราชญ์' },
        subClassUnlock: 10
    },

    // --- อาชีพหลัก T2 (เลื่อนขั้นจาก T1) ---
    'อัศวิน': {
        name: 'อัศวิน',
        tier: 2,
        bonuses: { STR: 5, CON: 3, DEX: 1 }, // (รวม +9)
        progression: { level: 40, to: 'อัศวินศักดิ์สิทธิ์' }
    },
    'Tank Master': {
        name: 'Tank Master',
        tier: 2,
        bonuses: { CON: 7, STR: 2 }, // (รวม +9)
        progression: { level: 40, to: null }
    },
    'จอมเวท': {
        name: 'จอมเวท',
        tier: 2,
        bonuses: { INT: 7, WIS: 2 }, // (รวม +9)
        progression: { level: 40, to: 'มหาจอมเวท' }
    },
    'นักปราชญ์': {
        name: 'นักปราชญ์',
        tier: 2,
        bonuses: { INT: 5, WIS: 5 }, // (รวม +10)
        progression: {
            level: 40,
            to: ['มหาปราชญ์', 'เจ้าเมือง'],
            choiceCondition: {
                'เจ้าเมือง': { from: 'พ่อค้า' },
                'มหาปราชญ์': { from: ['นักบวช', 'พ่อค้า'] }
            }
        }
    },
    'นักบุญหญิง': {
        name: 'นักบุญหญิง',
        tier: 2,
        bonuses: { WIS: 7, CHA: 2, CON: 1 }, // (รวม +10)
        progression: { level: 40, to: 'สตรีศักดิ์สิทธิ์' }
    },
    'นักฆ่า': {
        name: 'นักฆ่า',
        tier: 2,
        bonuses: { DEX: 7, STR: 2 }, // (รวม +9)
        progression: { level: 40, to: 'Hunter Master' }
    },
    'อาเชอร์': {
        name: 'อาเชอร์',
        tier: 2,
        bonuses: { DEX: 6, STR: 3 }, // (รวม +9)
        progression: { level: 40, to: 'Bow Master' }
    },

    // --- อาชีพหลัก T3 ---
    'อัศวินศักดิ์สิทธิ์': {
        name: 'อัศวินศักดิ์สิทธิ์',
        tier: 3,
        bonuses: { STR: 8, CON: 5, WIS: 2 }, // (รวม +15)
        progression: { level: 60, to: 'ผู้กล้า' }
    },
    'มหาจอมเวท': {
        name: 'มหาจอมเวท',
        tier: 3,
        bonuses: { INT: 10, WIS: 5 }, // (รวม +15)
        progression: { level: 60, to: 'Mage Master' }
    },
    'มหาปราชญ์': {
        name: 'มหาปราชญ์',
        tier: 3,
        bonuses: { INT: 8, WIS: 8 }, // (รวม +16)
        progression: { level: 60, to: null }
    },
    'สตรีศักดิ์สิทธิ์': {
        name: 'สตรีศักดิ์สิทธิ์',
        tier: 3,
        bonuses: { WIS: 10, CHA: 5, CON: 1 }, // (รวม +16)
        progression: { level: 60, to: null }
    },
    'Hunter Master': {
        name: 'Hunter Master',
        tier: 3,
        bonuses: { DEX: 10, STR: 3, CON: 2 }, // (รวม +15)
        progression: { level: 60, to: null }
    },
    'Bow Master': {
        name: 'Bow Master',
        tier: 3,
        bonuses: { DEX: 9, STR: 6 }, // (รวม +15)
        progression: { level: 60, to: null }
    },
    'เจ้าเมือง': {
        name: 'เจ้าเมือง',
        tier: 3,
        bonuses: { CHA: 8, INT: 5, STR: 2 }, // (รวม +15)
        progression: { level: 60, to: null }
    },

    // --- อาชีพหลัก T4 ---
    'ผู้กล้า': {
        name: 'ผู้กล้า',
        tier: 4,
        bonuses: { STR: 10, CON: 7, WIS: 5, DEX: 3 }, // (รวม +25)
        progression: { level: 80, to: null }
    },
    'Mage Master': {
        name: 'Mage Master',
        tier: 4,
        bonuses: { INT: 15, WIS: 7, CON: 3 }, // (รวม +25)
        progression: { level: 80, to: null }
    },

    // --- อาชีพลับ (Secret Class) ---
    // (อาชีพลับจะแทนที่อาชีพหลัก และไม่มีอาชีพรอง)
    'นักดาบเวทย์': {
        name: 'นักดาบเวทย์',
        tier: 2,
        secret: true,
        bonuses: { STR: 5, INT: 5 }, // (รวม +10, เทียบเท่า T2)
        requirement: { main: 'นักรบ', sub: 'นักเวท' },
        progression: { level: 30, to: 'จอมดาบมนตรา' }
    },
    'จอมดาบมนตรา': {
        name: 'จอมดาบมนตรา',
        tier: 3,
        secret: true,
        bonuses: { STR: 8, INT: 8 }, // (รวม +16, เทียบเท่า T3)
        progression: { level: 50, to: 'ราชันย์ดาบเวทย์' }
    },
    'ราชันย์ดาบเวทย์': {
        name: 'ราชันย์ดาบเวทย์',
        tier: 4,
        secret: true,
        bonuses: { STR: 12, INT: 12 }, // (รวม +24, เทียบเท่า T4)
        progression: { level: 70, to: null }
    },
    'จอมมาร': {
        name: 'จอมมาร',
        tier: 5,
        secret: true,
        bonuses: { STR: 15, INT: 15, CON: 10 }, // (รวม +40, เหนือ T4)
        progression: null
    }
};

/**
 * -----------------------------------------------------------------
 * 3. ฐานข้อมูลความชำนาญอาวุธ (ข้อ 5)
 * -----------------------------------------------------------------
 * ใช้สำหรับคำนวณโบนัส 1.5% เมื่อสวมใส่อาวุธหลัก
 */
const CLASS_WEAPON_PROFICIENCY = {
    // (สมมติฐานจากชื่ออาชีพ)
    'นักรบ': ['ดาบ', 'ขวาน', 'ดาบใหญ่', 'หอก', 'อาวุธทื่อ', 'โล่'],
    'อัศวิน': ['ดาบ', 'หอก', 'ดาบใหญ่', 'โล่'],
    'อัศวินศักดิ์สิทธิ์': ['ดาบใหญ่', 'ค้อน', 'โล่'],
    'ผู้กล้า': ['ดาบ', 'ดาบใหญ่', 'โล่'],

    'แทงค์': ['โล่', 'อาวุธทื่อ', 'ค้อน', 'กระบอง'],
    'Tank Master': ['โล่', 'อาวุธทื่อ', 'ค้อน', 'กระบอง'],
    
    'นักเวท': ['คทา', 'ไม้เท้า', 'หนังสือเวท'],
    'จอมเวท': ['คทา', 'ไม้เท้า', 'หนังสือเวท'],
    'มหาจอมเวท': ['คทา', 'ไม้เท้า', 'หนังสือเวท'],
    'Mage Master': ['คทา', 'ไม้เท้า', 'หนังสือเวท'],

    'นักบวช': ['ค้อน', 'กระบอง', 'โล่', 'ไม้เท้า'],
    'นักปราชญ์': ['คทา', 'ไม้เท้า', 'หนังสือเวท', 'กระบอง'],
    'มหาปราชญ์': ['คทา', 'ไม้เท้า', 'หนังสือเวท'],
    'นักบุญหญิง': ['คทา', 'ไม้เท้า', 'โล่'],
    'สตรีศักดิ์สิทธิ์': ['คทา', 'ไม้เท้า', 'โล่'],
    
    'โจร': ['มีด', 'ดาบสั้น', 'อาวุธซัด', 'หน้าไม้'],
    'นักฆ่า': ['มีด', 'ดาบสั้น', 'อาวุธซัด'],
    'Hunter Master': ['มีด', 'ดาบสั้น', 'อาวุธซัด', 'ธนู', 'หน้าไม้'],
    
    'เรนเจอร์': ['ธนู', 'หน้าไม้', 'ดาบ'],
    'อาเชอร์': ['ธนู', 'หน้าไม้'],
    'Bow Master': ['ธนู', 'หน้าไม้'],
    
    'พ่อค้า': ['มีด', 'กระบอง'],
    'เจ้าเมือง': ['ดาบ', 'โล่'],
    
    'นักดาบเวทย์': ['ดาบ', 'ดาบใหญ่', 'คทา', 'ไม้เท้า'],
    'จอมดาบมนตรา': ['ดาบ', 'ดาบใหญ่', 'คทา', 'ไม้เท้า'],
    'ราชันย์ดาบเวทย์': ['ดาบ', 'ดาบใหญ่', 'คทา', 'ไม้เท้า'],
    
    'จอมมาร': ['ดาบใหญ่', 'คทา', 'ไม้เท้า', 'อาวุธทื่อ']
};

// (Helper: รายการอาวุธที่ใช้ DEX แทน STR - ข้อ 5)
const DEX_WEAPONS = ['มีด', 'ดาบสั้น', 'อาวุธซัด', 'ธนู', 'หน้าไม้'];


/**
 * -----------------------------------------------------------------
 * 4. ฐานข้อมูลสกิล (ข้อ 12)
 * -----------------------------------------------------------------
 * สกิลทั้งหมดจากเผ่าพันธุ์ และอาชีพใหม่
 */
const SKILL_DATA = {

    // --- สกิลเผ่า (จากข้อ 11) ---
    'therian_roar': {
        id: 'therian_roar',
        name: 'ปลดปล่อยสัญชาตญาณ',
        description: 'เพิ่ม ATK (STR) 30% และ Speed (DEX) 20% (d4 เทิร์น), ลด DEF (CON) 15%',
        targetType: 'self', skillType: 'BUFF_DEBUFF', skillTrigger: 'ACTIVE',
        cooldown: { type: 'PER_COMBAT', uses: 1 },
        effect: {
            type: 'MULTI_TEMP_STAT_PERCENT',
            durationDice: 'd4',
            stats: [
                { stat: 'STR', amount: 30 },
                { stat: 'DEX', amount: 20 },
                { stat: 'CON', amount: -15 } // (สมมติ DEF คือ CON)
            ]
        }
    },
    'dragon_breath': {
        id: 'dragon_breath',
        name: 'ลมหายใจมังกร',
        description: 'โจมตีศัตรูทั้งหมดด้วยธาตุ (เลือก 1 ธาตุตอนวิวัฒนาการ)',
        targetType: 'enemy_all', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
        cooldown: { type: 'PERSONAL', turns: 8 },
        effect: {
            type: 'ELEMENTAL_DAMAGE',
            element: 'DRAGON_BREATH_ELEMENT', // (ต้องมี Logic ให้ผู้เล่นเลือกธาตุตอนวิวัฒนาการ)
            damageDice: 'd20',
            scalingStat: 'INT'
        }
    },
    'god_judgment': {
        id: 'god_judgment',
        name: 'พิพากษา',
        description: 'หาก HP < 50% ตายทันที, หาก > 50% โดน 75% MaxHP',
        targetType: 'enemy', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
        cooldown: { type: 'PER_COMBAT', uses: 1 },
        effect: {
            type: 'FORMULA',
            formula: 'GOD_JUDGMENT' // (HP < 50% ? DIE : DMG 75% MaxHP)
        }
    },

    // --- สกิลอาชีพ (จากข้อ 12) ---

    // 1. สายนักรบ
    'นักรบ': [
        {
            id: 'warrior_will', name: 'เจตจำนงแห่งนักรบ',
            description: 'เพิ่มค่าสเตตัสทั้งหมดขึ้น 15% (d6 เทิร์น)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amount: 15, durationDice: 'd6' }
        }
    ],
    'อัศวิน': [
        {
            id: 'knight_honor', name: 'เกียรติยศแห่งอัศวิน',
            description: 'เพิ่มค่าสตัสทั้งหมดขึ้น 20% (d6 เทิร์น)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amount: 20, durationDice: 'd6' },
            passives: [ // (สกิลติดตัว)
                { id: 'knight_passive_1', name: 'ลดความเสียหาย', description: 'ลดความเสียหายที่ได้รับ 5%', effect: { type: 'REDUCE_DMG_PERCENT', amount: 5 } }
            ]
        }
    ],
    'อัศวินศักดิ์สิทธิ์': [
        {
            id: 'holy_knight_honor', name: 'เกียรติยศแห่งอัศวินศักดิ์สิทธิ์',
            description: 'เพิ่มสเตตัสทั้งหมดขึ้น 30% (d6 เทิร์น)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amount: 30, durationDice: 'd6' }
        },
        {
            id: 'holy_knight_light_sword', name: 'ดาบแห่งแสง',
            description: 'เคลือบดาบ, โจมตีปกติแรงเป็น %HP (5 เทิร์น)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PER_COMBAT', uses: 1 },
            effect: {
                type: 'WEAPON_BUFF',
                element: 'HOLY',
                duration: 5,
                buffId: 'HOLY_LIGHT_FORMULA_ATTACK' // (สูตร: ((dAtk + STR)*0.15)*TargetCurrentHP)
            },
            passives: [ // (สกิลติดตัว)
                { id: 'holy_knight_passive_1', name: 'ลดความเสียหาย', description: 'ลดความเสียหาย 15%', effect: { type: 'REDUCE_DMG_PERCENT', amount: 15 } },
                { id: 'holy_knight_passive_2', name: 'ล่าอันเดด', description: 'โจมตี [อันเดด] แรงขึ้น 30%', effect: { type: 'DMG_BONUS_VS_RACE', race: ['อันเดด'], amount: 30 } }
            ]
        }
    ],
    'ผู้กล้า': [
        {
            id: 'hero_miracle', name: 'ปาฏิหาริย์แห่งผู้กล้า',
            description: 'เพิ่มสเตตัสทั้งหมด (ตนเอง+พันธมิตร) 35% (d6 เทิร์น)',
            targetType: 'teammate_all_self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 10 },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amount: 35, durationDice: 'd6' }
        },
        {
            id: 'hero_justice_sword', name: 'ดาบพิฆาตอธรรม',
            description: 'โจมตี %HP ((d20+STR+WIS)*0.50) (x2 vs มาร/อันเดด)',
            targetType: 'enemy', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PER_COMBAT', uses: 3 },
            effect: {
                type: 'FORMULA',
                formula: 'HERO_JUSTICE_SWORD', // ((d20+STR_Bonus+WIS_Bonus)*0.50)*TargetCurrentHP
                element: 'HOLY',
                bonusVs: { races: ['มาร', 'อันเดด', 'อสูร'], multiplier: 2.0 }
            }
        },
        {
            id: 'hero_aegis_valor', name: 'โล่แห่งความกล้าหาญ',
            description: 'สร้างโล่ป้องกันความเสียหายทั้งหมดให้พันธมิตร 1 คน (2 เทิร์น)',
            targetType: 'teammate', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: {
                type: 'SHIELD',
                shieldType: 'ALL_DAMAGE',
                duration: 2,
                formula: 'AEGIS_SHIELD_HP' // (เช่น (Caster_MaxHP * 0.25))
            },
            passives: [ // (สกิลติดตัว)
                { id: 'hero_passive_1', name: 'จิตใจแห่งผู้กล้า (ลดDmg)', description: 'ลดความเสียหายทั้งหมด 25%', effect: { type: 'REDUCE_DMG_PERCENT', amount: 25 } },
                { id: 'hero_passive_2', name: 'จิตใจแห่งผู้กล้า (ล่าอสูร)', description: 'โจมตี [อันเดด, มาร, อสูร] แรงขึ้น 50%', effect: { type: 'DMG_BONUS_VS_RACE', race: ['อันเดด', 'มาร', 'อสูร'], amount: 50 } },
                { id: 'hero_passive_3', name: 'จิตใจแห่งผู้กล้า (ต้านทาน)', description: 'ต้านทานสถานะผิดปกติ 30%', effect: { type: 'STATUS_RESIST_PERCENT', amount: 30 } }
            ]
        }
    ],

    // 2. สายแทงค์
    'แทงค์': [
        {
            id: 'tank_taunt_single', name: 'ยั่วยุ (เดี่ยว)',
            description: 'บังคับศัตรู 1 ตัวโจมตีตนเอง, เพิ่ม CON 25% (d4 เทิร์น)',
            targetType: 'enemy', skillType: 'CONTROL_BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' }, // (เช็คอัตราสำเร็จ)
            effect: { type: 'CONTROL', status: 'TAUNT', durationDice: 'd4' },
            selfEffect: { type: 'MULTI_TEMP_STAT_PERCENT', stats: [{ stat: 'CON', amount: 25 }], durationDice: 'd4' }
        },
        {
            id: 'tank_taunt_aoe', name: 'ยั่วยุ (วงกว้าง)',
            description: 'บังคับศัตรูทั้งหมดโจมตีตนเอง, เพิ่ม CON 40% (d4 เทิร์น)',
            targetType: 'enemy_all', skillType: 'CONTROL_BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' }, // (เช็คแยกแต่ละตัว)
            effect: { type: 'CONTROL', status: 'TAUNT', durationDice: 'd4' },
            selfEffect: { type: 'MULTI_TEMP_STAT_PERCENT', stats: [{ stat: 'CON', amount: 40 }], durationDice: 'd4' }
        }
    ],
    'Tank Master': [
        {
            id: 'tank_master_taunt_single', name: 'ยั่วยุ (เดี่ยว V2)',
            description: 'บังคับศัตรู 1 ตัวโจมตีตนเอง, เพิ่ม CON 35% (d4 เทิร์น)',
            targetType: 'enemy', skillType: 'CONTROL_BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' },
            effect: { type: 'CONTROL', status: 'TAUNT', durationDice: 'd4' },
            selfEffect: { type: 'MULTI_TEMP_STAT_PERCENT', stats: [{ stat: 'CON', amount: 35 }], durationDice: 'd4' }
        },
        {
            id: 'tank_master_taunt_aoe', name: 'ยั่วยุ (วงกว้าง V2)',
            description: 'บังคับศัตรูทั้งหมดโจมตีตนเอง, เพิ่ม CON 50% (d4 เทิร์น)',
            targetType: 'enemy_all', skillType: 'CONTROL_BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' },
            effect: { type: 'CONTROL', status: 'TAUNT', durationDice: 'd4' },
            selfEffect: { type: 'MULTI_TEMP_STAT_PERCENT', stats: [{ stat: 'CON', amount: 50 }], durationDice: 'd4' }
        },
        { // (สกิลติดตัว)
            id: 'tank_master_passive_1', name: 'ป้องกัน True Dmg',
            description: 'ป้องกันความเสียหายจริง (True Damage) 75%',
            skillTrigger: 'PASSIVE',
            effect: { type: 'REDUCE_TRUE_DMG_PERCENT', amount: 75 }
        },
        {
            id: 'tank_master_passive_2', name: 'ฮีลฉุกเฉิน',
            description: 'หาก HP < 20% จะฮีลตนเอง 2.5% MaxHP เมื่อโดนโจมตี',
            skillTrigger: 'PASSIVE',
            effect: { type: 'LOW_HP_HEAL', threshold: 0.20, healPercent: 0.025 }
        }
    ],

    // 3. สายนักเวท
    'นักเวท': [
        {
            id: 'mage_elemental_select', name: 'เวทธาตุ (V1)',
            description: 'เลือกธาตุ (ดิน, น้ำ, ลม, ไฟ, น้ำแข็ง, สายฟ้า, ไม้)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'NONE' },
            effect: {
                type: 'ELEMENT_SELECT',
                elements: ['ดิน', 'น้ำ', 'ลม', 'ไฟ', 'น้ำแข็ง', 'สายฟ้า', 'ไม้'],
                selectCount: 1
            },
            passives: [ // (สกิลติดตัว)
                {
                    id: 'mage_passive_1', name: 'โจมตีเวทย์ (%HP)',
                    description: 'การโจมตีปกติใช้ INT คำนวณเป็น %HP',
                    skillTrigger: 'PASSIVE',
                    effect: { type: 'FORMULA_ATTACK_OVERRIDE', formula: 'MAGE_PASSIVE_V1' } // ((dWeapon + INT_Bonus)*0.15)*TargetCurrentHP
                },
                {
                    id: 'mage_passive_2', name: 'ปฏิกิริยาธาตุ',
                    description: 'แปะธาตุและเกิดปฏิกิริยา (CD 3 เทิร์น)',
                    skillTrigger: 'PASSIVE',
                    effect: { type: 'ELEMENTAL_REACTION', cooldown: 3 }
                }
            ]
        }
    ],
    'จอมเวท': [
        {
            id: 'archmage_elemental_select_v2', name: 'เวทธาตุ (V2)',
            description: 'เลือกธาตุ (ดิน, น้ำ, ลม, ไฟ, น้ำแข็ง, สายฟ้า, ไม้)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'NONE' },
            effect: {
                type: 'ELEMENT_SELECT',
                elements: ['ดิน', 'น้ำ', 'ลม', 'ไฟ', 'น้ำแข็ง', 'สายฟ้า', 'ไม้'],
                selectCount: 1
            },
            passives: [ // (สกิลติดตัว อัปเกรด)
                {
                    id: 'mage_passive_v2', name: 'โจมตีเวทย์ (%HP V2)',
                    description: 'การโจมตีปกติใช้ INT/WIS คำนวณเป็น %HP',
                    skillTrigger: 'PASSIVE',
                    effect: { type: 'FORMULA_ATTACK_OVERRIDE', formula: 'MAGE_PASSIVE_V2' } // ((dWeapon + INT + WIS)*0.20)*TargetCurrentHP
                },
                {
                    id: 'mage_passive_2', name: 'ปฏิกิริยาธาตุ',
                    description: 'แปะธาตุและเกิดปฏิกิริยา (CD 3 เทิร์น)',
                    skillTrigger: 'PASSIVE',
                    effect: { type: 'ELEMENTAL_REACTION', cooldown: 3 }
                }
            ]
        }
    ],
    'มหาจอมเวท': [
        {
            id: 'archmage_elemental_select_v3', name: 'เวทธาตุ (V3)',
            description: 'เลือกธาตุ (เพิ่ม แสง, มืด)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'NONE' },
            effect: {
                type: 'ELEMENT_SELECT',
                elements: ['ดิน', 'น้ำ', 'ลม', 'ไฟ', 'น้ำแข็ง', 'สายฟ้า', 'ไม้', 'แสง', 'มืด'],
                selectCount: 1
            },
            passives: [ // (สกิลติดตัว อัปเกรด)
                {
                    id: 'mage_passive_v3', name: 'โจมตีเวทย์ (%HP V3)',
                    description: 'การโจมตีปกติใช้ INT/WIS คำนวณเป็น %HP',
                    skillTrigger: 'PASSIVE',
                    effect: { type: 'FORMULA_ATTACK_OVERRIDE', formula: 'MAGE_PASSIVE_V3' } // ((dWeapon + INT + WIS)*0.30)*TargetCurrentHP
                },
                {
                    id: 'mage_passive_2', name: 'ปฏิกิริยาธาตุ',
                    description: 'แปะธาตุและเกิดปฏิกิริยา (CD 3 เทิร์น)',
                    skillTrigger: 'PASSIVE',
                    effect: { type: 'ELEMENTAL_REACTION', cooldown: 3 }
                }
            ]
        }
    ],
    'Mage Master': [
        {
            id: 'mage_master_elemental_select', name: 'เวทประสาน (V4)',
            description: 'เลือก 2 ธาตุพร้อมกัน',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'NONE' },
            effect: {
                type: 'ELEMENT_SELECT',
                elements: ['ดิน', 'น้ำ', 'ลม', 'ไฟ', 'น้ำแข็ง', 'สายฟ้า', 'ไม้', 'แสง', 'มืด'],
                selectCount: 2
            },
            passives: [ // (สกิลติดตัว อัปเกรด)
                {
                    id: 'mage_passive_v4', name: 'โจมตีเวทย์ (%HP V4)',
                    description: 'การโจมตีปกติใช้ INT/WIS คำนวณเป็น %HP',
                    skillTrigger: 'PASSIVE',
                    effect: { type: 'FORMULA_ATTACK_OVERRIDE', formula: 'MAGE_PASSIVE_V4' } // ((dWeapon + INT + WIS)*0.60)*TargetCurrentHP
                },
                {
                    id: 'mage_passive_v4_reaction', name: 'ปฏิกิริยาไร้คูลดาวน์',
                    description: 'เกิดปฏิกิริยาธาตุเสมอ',
                    skillTrigger: 'PASSIVE',
                    effect: { type: 'ELEMENTAL_REACTION', cooldown: 0 }
                }
            ]
        }
    ],

    // 4. สายนักบวช
    'นักบวช': [
        {
            id: 'cleric_heal_single', name: 'ฮีล (เดี่ยว)',
            description: 'ฮีลเพื่อน 1 คน ((d4% + WIS Bonus) * TargetMaxHP)',
            targetType: 'teammate', skillType: 'HEAL', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 3 },
            effect: { type: 'FORMULA_HEAL', formula: 'CLERIC_HEAL_V1' }
        },
        {
            id: 'cleric_debuff_aoe', name: 'ดีบัฟ (ทั้งหมด)',
            description: 'ลดสเตตัสทั้งหมดศัตรู 15% (d4 เทิร์น)',
            targetType: 'enemy_all', skillType: 'DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amount: -15, isDebuff: true, durationDice: 'd4' }
        },
        {
            id: 'cleric_buff_aoe', name: 'บัฟ (ทั้งหมด)',
            description: 'บัฟสเตตัสทั้งหมดทีม d6% (d4 เทิร์น)',
            targetType: 'teammate_all_self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amountDice: 'd6', durationDice: 'd4' }
        },
        { // (สกิลติดตัว)
            id: 'cleric_passive_1', name: 'พิพากษาอันเดด',
            description: 'โจมตี [อันเดด] เป็น %HP',
            skillTrigger: 'PASSIVE',
            effect: { type: 'DMG_BONUS_VS_RACE', race: ['อันเดด'], formula: 'DAMAGE_VS_UNDEAD_PERCENT' }
        },
        {
            id: 'cleric_passive_2', name: 'ฮีลย้อนกลับ',
            description: 'ฮีล [อันเดด] = สร้างความเสียหาย',
            skillTrigger: 'PASSIVE',
            effect: { type: 'HEAL_REVERSE_VS_RACE', race: ['อันเดด'] }
        }
    ],
    'นักปราชญ์': [
        {
            id: 'sage_heal_multi', name: 'ฮีล (กลุ่ม)',
            description: 'ฮีลเพื่อน 3 คน ((d6% + WIS Bonus) * TargetMaxHP)',
            targetType: 'teammate_multi_3', skillType: 'HEAL', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 3 },
            effect: { type: 'FORMULA_HEAL', formula: 'SAGE_HEAL_V1' }
        },
        {
            id: 'sage_debuff_aoe', name: 'ดีบัฟ (นักปราชญ์)',
            description: 'ลดสเตตัสทั้งหมดศัตรู 15% (d4 เทิร์น)',
            targetType: 'enemy_all', skillType: 'DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amount: -15, isDebuff: true, durationDice: 'd4' }
        },
        {
            id: 'sage_buff_aoe', name: 'บัฟ (นักปราชญ์)',
            description: 'บัฟสเตตัสทั้งหมดทีม d12% (d4 เทิร์น)',
            targetType: 'teammate_all_self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amountDice: 'd12', durationDice: 'd4' }
        },
        { // (สกิลติดตัว)
            id: 'sage_passive_1', name: 'ออร่าปัญญา',
            description: 'INT/WIS ทั้งทีม +15%',
            skillTrigger: 'PASSIVE',
            effect: { type: 'AURA_STAT_PERCENT', stats: ['INT', 'WIS'], amount: 15 }
        },
        { id: 'cleric_passive_1', skillTrigger: 'PASSIVE' }, // (สืบทอด)
        { id: 'cleric_passive_2', skillTrigger: 'PASSIVE' }  // (สืบทอด)
    ],
    'มหาปราชญ์': [
        {
            id: 'archsage_heal_multi', name: 'ฮีล (มหาปราชญ์)',
            description: 'ฮีลเพื่อน 5 คน ((d8% + WIS + 0.25*MaxHP) * TargetMaxHP)',
            targetType: 'teammate_multi_5', skillType: 'HEAL', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 3 },
            effect: { type: 'FORMULA_HEAL', formula: 'ARCHSAGE_HEAL_V1' }
        },
        {
            id: 'archsage_debuff_aoe', name: 'ดีบัฟ (มหาปราชญ์)',
            description: 'ลดสเตตัสทั้งหมดศัตรู 30% (d4 เทิร์น)',
            targetType: 'enemy_all', skillType: 'DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amount: -30, isDebuff: true, durationDice: 'd4' }
        },
        {
            id: 'archsage_buff_aoe', name: 'บัฟ (มหาปราชญ์)',
            description: 'บัฟสเตตัสทั้งหมดทีม d20% (d6 เทิร์น)',
            targetType: 'teammate_all_self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amountDice: 'd20', durationDice: 'd6' }
        },
        {
            id: 'archsage_forbidden_wisdom', name: 'ปัญญาต้องห้าม',
            description: 'เพิ่มเลเวลทีมชั่วคราว d50% (6 เทิร์น)',
            targetType: 'teammate_all_self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PER_COMBAT', uses: 1 },
            effect: {
                type: 'TEMP_LEVEL_PERCENT',
                amountDice: 'd50',
                duration: 6
            }
        },
        {
            id: 'archsage_forbidden_judgment', name: 'คำพิพากษาต้องห้าม',
            description: 'ทอย d40 >= 35 ฆ่าศัตรูทั้งหมด, แลก MaxHP ถาวร',
            targetType: 'enemy_all', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            successRoll: { check: 'd40', dc: 35 },
            failCooldown: { type: 'PERSONAL', turns: 3 }, // (ถ้าพลาด รอ 3 เทิร์น)
            successCooldown: { type: 'PER_COMBAT', uses: 1 }, // (ถ้าสำเร็จ 1 ครั้ง/ต่อสู้)
            effect: { type: 'FORMULA', formula: 'ARCHSAGE_JUDGMENT' },
            selfCost: { type: 'PERMANENT_HP_LOSS_ROLL', rollMap: { 35: 5, 36: 4, 37: 3, 38: 2, 39: 1, 40: 1 } }
        },
        { // (สกิลติดตัว)
            id: 'archsage_passive_1', name: 'ออร่ามหาปัญญา',
            description: 'INT/WIS ทั้งทีม +30%',
            skillTrigger: 'PASSIVE',
            effect: { type: 'AURA_STAT_PERCENT', stats: ['INT', 'WIS'], amount: 30 }
        },
        { id: 'cleric_passive_1', skillTrigger: 'PASSIVE' }, // (สืบทอด)
        { id: 'cleric_passive_2', skillTrigger: 'PASSIVE' }  // (สืบทอด)
    ],
    'นักบุญหญิง': [
        // (สกิลคล้าย 'มหาปราชญ์' แต่เปลี่ยนตัวเลข)
        {
            id: 'saint_heal_multi', name: 'ฮีล (นักบุญหญิง)',
            description: 'ฮีลเพื่อน 5 คน ((d8% + WIS + 0.25*MaxHP) * TargetMaxHP)',
            targetType: 'teammate_multi_5', skillType: 'HEAL', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 3 },
            effect: { type: 'FORMULA_HEAL', formula: 'ARCHSAGE_HEAL_V1' } // (ใช้สูตรเดียวกัน)
        },
        {
            id: 'saint_debuff_aoe', name: 'ดีบัฟ (นักบุญหญิง)',
            description: 'ลดสเตตัสทั้งหมดศัตรู 15% (d4 เทิร์น)',
            targetType: 'enemy_all', skillType: 'DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amount: -15, isDebuff: true, durationDice: 'd4' }
        },
        {
            id: 'saint_buff_aoe', name: 'บัฟ (นักบุญหญิง)',
            description: 'บัฟสเตตัสทั้งหมดทีม d20% (d6 เทิร์น)',
            targetType: 'teammate_all_self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amountDice: 'd20', durationDice: 'd6' }
        },
        { // (สกิลติดตัว)
            id: 'saint_passive_1', name: 'ออร่าศักดิ์สิทธิ์',
            description: 'WIS ทั้งทีม +15%',
            skillTrigger: 'PASSIVE',
            effect: { type: 'AURA_STAT_PERCENT', stats: ['WIS'], amount: 15 }
        },
        { id: 'cleric_passive_1', skillTrigger: 'PASSIVE' }, // (สืบทอด)
        { id: 'cleric_passive_2', skillTrigger: 'PASSIVE' }  // (สืบทอด)
    ],
    'สตรีศักดิ์สิทธิ์': [
        {
            id: 'holy_lady_heal_multi', name: 'ฮีล (สตรีศักดิ์สิทธิ์)',
            description: 'ฮีลเพื่อน 10 คน ((d8% + WIS + 0.25*MaxHP) * TargetMaxHP)',
            targetType: 'teammate_all_self', skillType: 'HEAL', skillTrigger: 'ACTIVE', // (ฮีล 10 คน = ทั้งทีม)
            cooldown: { type: 'PERSONAL', turns: 3 },
            effect: { type: 'FORMULA_HEAL', formula: 'ARCHSAGE_HEAL_V1' } // (ใช้สูตรเดิม)
        },
        {
            id: 'holy_lady_debuff_aoe', name: 'ดีบัฟ (สตรีศักดิ์สิทธิ์)',
            description: 'ลดสเตตัสทั้งหมดศัตรู 30% (d4 เทิร์น)',
            targetType: 'enemy_all', skillType: 'DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amount: -30, isDebuff: true, durationDice: 'd4' }
        },
        {
            id: 'holy_lady_buff_aoe', name: 'บัฟ (สตรีศักดิ์สิทธิ์)',
            description: 'บัฟสเตตัสทั้งหมดทีม d20% (d6 เทิร์น)',
            targetType: 'teammate_all_self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: { type: 'ALL_TEMP_STAT_PERCENT', amountDice: 'd20', durationDice: 'd6' }
        },
        {
            id: 'holy_lady_judgment', name: 'การพิพากษาจากสตรีศักดิ์สิทธิ์',
            description: 'โจมตี %HP (CurrentHP * 0.50), เสีย 20% MaxHP ชั่วคราว (3 ครั้ง/ต่อสู้)',
            targetType: 'enemy_all', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PER_COMBAT', uses: 3, personalTurns: 10 }, // (ใช้ได้ 3 ครั้ง, ติดคูลดาวน์ 10 เทิร์นส่วนตัว)
            effect: { type: 'FORMULA', formula: 'HOLY_LADY_JUDGMENT' }, // (CurrentHP * 0.50)
            selfCost: {
                type: 'TEMP_MAXHP_LOSS_PERCENT', // (เสีย MaxHP ชั่วคราว)
                amount: 20,
                duration: 999, // (อยู่จนจบการต่อสู้)
                stackable: true,
                resetAfterCombat: 3 // (ต้องจบการต่อสู้ 3 ครั้ง)
            }
        },
        { // (สกิลติดตัว)
            id: 'holy_lady_passive_1', name: 'ออร่าสวรรค์',
            description: 'WIS ทั้งทีม +25%',
            skillTrigger: 'PASSIVE',
            effect: { type: 'AURA_STAT_PERCENT', stats: ['WIS'], amount: 25 }
        },
        { id: 'cleric_passive_1', skillTrigger: 'PASSIVE' }, // (สืบทอด)
        { id: 'cleric_passive_2', skillTrigger: 'PASSIVE' }  // (สืบทอด)
    ],

    // 5. สายโจร
    'โจร': [
        {
            id: 'rogue_stealth', name: 'เงาเร้นลับ',
            description: 'ทอย d20+DEX (vs ศัตรู DEX) สำเร็จ หายตัว 3 เทิร์น',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 6 }, // (คูลดาวน์จากสายนักฆ่า)
            successRoll: { check: 'd20', resistStat: 'DEX', type: 'CONTESTED' }, // (ทอยแข่ง)
            effect: { type: 'STATUS', status: 'INVISIBILE', duration: 3 }
        },
        { // (สกิลติดตัว)
            id: 'rogue_passive_1', name: 'มือเบา',
            description: 'ปลดล็อคและกู้กับดักง่ายขึ้น 50%',
            skillTrigger: 'PASSIVE',
            effect: { type: 'SKILL_CHECK_BONUS_PERCENT', skills: ['LOCKPICK', 'TRAP'], amount: 50 }
        }
    ],
    'นักฆ่า': [
        { id: 'rogue_stealth' }, // (สืบทอด)
        {
            id: 'assassin_backstab', name: 'แทงข้างหลัง',
            description: 'สร้างความเสียหาย x2 จากเดิม',
            targetType: 'enemy', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 4 },
            effect: { type: 'DAMAGE_MULTIPLIER', multiplier: 2.0 } // (ใช้กับการโจมตีปกติครั้งถัดไป)
        },
        {
            id: 'assassin_poison_fang', name: 'เขี้ยวอสรพิษ',
            description: 'ศัตรูโดนดาเมจพิษ d4% (d12 เทิร์น) (นับทุกเทิร์น)',
            targetType: 'enemy', skillType: 'DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 6 },
            effect: {
                type: 'DOT',
                element: 'POISON',
                damageDice: 'd4',
                damageType: 'PERCENT_CURRENT_HP',
                duration: 12,
                tickOn: 'GLOBAL' // (นับทุกเทิร์น)
            }
        },
        { // (สกิลติดตัว)
            id: 'assassin_passive_1', name: 'เชี่ยวชาญมีด',
            description: 'อาวุธประเภทมีดแรงขึ้น 25%',
            skillTrigger: 'PASSIVE',
            effect: { type: 'WEAPON_DMG_BONUS_PERCENT', weaponTypes: ['มีด'], amount: 25 }
        },
        { id: 'rogue_passive_1', skillTrigger: 'PASSIVE' } // (สืบทอด)
    ],
    'Hunter Master': [
        { id: 'rogue_stealth' }, // (สืบทอด)
        { id: 'assassin_backstab' }, // (สืบทอด)
        { id: 'assassin_poison_fang' }, // (สืบทอด)
        {
            id: 'hunter_master_intimidate', name: 'ข่มขวัญ',
            description: 'ลดสเตตัสทั้งหมดศัตรู d50% (อิง WIS ศัตรู)',
            targetType: 'enemy', skillType: 'DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' },
            effect: {
                type: 'ALL_TEMP_STAT_PERCENT',
                amountDice: 'd50',
                isDebuff: true,
                durationDice: 'd4'
            }
        },
        { // (สกิลติดตัว)
            id: 'hunter_master_passive_1', name: 'เชี่ยวชาญอาวุธ',
            description: 'อาวุธทุกชนิดแรงขึ้น 30%',
            skillTrigger: 'PASSIVE',
            effect: { type: 'WEAPON_DMG_BONUS_PERCENT', weaponTypes: ['ALL'], amount: 30 }
        },
        { id: 'rogue_passive_1', skillTrigger: 'PASSIVE' } // (สืบทอด)
    ],

    // 6. สายเรนเจอร์
    'เรนเจอร์': [
        {
            id: 'ranger_armor_pierce', name: 'ยิงเจาะเกราะ',
            description: 'ลด DEF (AC) เป้าหมาย 20% (d6 เทิร์น)',
            targetType: 'enemy', skillType: 'DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 4 },
            effect: {
                type: 'TEMP_STAT_PERCENT',
                stat: 'CON', // (สมมติ AC คือ CON)
                amount: -20,
                isDebuff: true,
                durationDice: 'd6'
            }
        },
        {
            id: 'ranger_set_trap', name: 'วางกับดัก',
            description: 'ศัตรูที่เดินผ่านจะถูก [พันธนาการ] (d4 เทิร์น)',
            targetType: 'ground', skillType: 'CONTROL', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 6 },
            effect: { type: 'TRAP', status: 'ROOTED', durationDice: 'd4' }
        },
        { // (สกิลติดตัว)
            id: 'ranger_passive_1', name: 'สายตาเหยี่ยว',
            description: 'เพิ่มความแม่นยำ +2 และระยะยิง 50%',
            skillTrigger: 'PASSIVE',
            effect: [
                { type: 'HIT_RATE_BONUS', amount: 2 },
                { type: 'RANGE_BONUS_PERCENT', amount: 50 }
            ]
        }
    ],
    'อาเชอร์': [
        {
            id: 'archer_rapid_shot', name: 'ยิงเร็ว',
            description: 'โจมตี 3 ครั้ง (ความแรง 70%)',
            targetType: 'enemy', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 5 },
            effect: { type: 'MULTI_HIT_ATTACK', hits: 3, multiplier: 0.70 }
        },
        {
            id: 'archer_explosive_arrow', name: 'ศรระเบิด',
            description: 'โจมตี (d12 + DEX Bonus) แก่เป้าหมายและศัตรูรอบข้าง',
            targetType: 'enemy_aoe', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 6 },
            effect: {
                type: 'DAMAGE',
                damageDice: 'd12',
                scalingStat: 'DEX',
                element: 'FIRE'
            }
        },
        { // (สกิลติดตัว)
            id: 'archer_passive_1', name: 'เชี่ยวชาญธนู',
            description: 'ธนูแรงขึ้น 20%, 10% ยิงซ้ำ',
            skillTrigger: 'PASSIVE',
            effect: [
                { type: 'WEAPON_DMG_BONUS_PERCENT', weaponTypes: ['ธนู'], amount: 20 },
                { type: 'PROC_CHANCE', chance: 10, effect: 'EXTRA_TURN' }
            ]
        },
        { id: 'ranger_passive_1', skillTrigger: 'PASSIVE' } // (สืบทอด)
    ],
    'Bow Master': [
        {
            id: 'bow_master_arrow_rain', name: 'ฝนธนู',
            description: 'โจมตีศัตรูทั้งหมด (DEX Bonus * d6) (3 เทิร์น)',
            targetType: 'enemy_all', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 10 },
            effect: {
                type: 'DOT_AREA',
                formula: 'BOW_MASTER_RAIN', // (DEX_Bonus * d6)
                duration: 3,
                tickOn: 'GLOBAL'
            }
        },
        {
            id: 'bow_master_execution_eye', name: 'เนตรเหยี่ยวสังหาร',
            description: 'โจมตี %HP ((d20+DEX+WIS)*0.40)',
            targetType: 'enemy', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PER_COMBAT', uses: 3, personalTurns: 8 },
            effect: {
                type: 'FORMULA',
                formula: 'BOW_MASTER_EXECUTE' // ((d20+DEX_Bonus+WIS_Bonus)*0.40)*TargetCurrentHP
            }
        },
        { // (สกิลติดตัว)
            id: 'bow_master_passive_1', name: 'ปรมาจารย์ธนู',
            description: 'ธนูแรงขึ้น 40%, 25% ยิงซ้ำ',
            skillTrigger: 'PASSIVE',
            effect: [
                { type: 'WEAPON_DMG_BONUS_PERCENT', weaponTypes: ['ธนู'], amount: 40 },
                { type: 'PROC_CHANCE', chance: 25, effect: 'EXTRA_TURN' }
            ]
        },
        { id: 'ranger_passive_1', skillTrigger: 'PASSIVE' } // (สืบทอด)
    ],
    
    // 7. สายพ่อค้า / เจ้าเมือง
    'พ่อค้า': [
        {
            id: 'merchant_hire_mercenary', name: 'จ้างทหารรับจ้าง',
            description: 'ใช้ [X Gold] เรียก [ทหารรับจ้าง] (d6 เทิร์น)',
            targetType: 'self', skillType: 'SUMMON', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 6 },
            effect: {
                type: 'SUMMON',
                unitId: 'mercenary',
                durationDice: 'd6',
                cost: { type: 'GP', amountFormula: 'LEVEL*10' }
            }
        },
        {
            id: 'merchant_throw_concoction', name: 'ปาสารพัดประโยชน์',
            description: 'สุ่มติดสถานะ (พิษ, อัมพาต, เผาไหม้) (d4 เทิร์น)',
            targetType: 'enemy', skillType: 'DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 4 },
            effect: {
                type: 'RANDOM_STATUS',
                statuses: ['POISONED', 'PARALYZED', 'BURNING'],
                durationDice: 'd4'
            }
        },
        { // (สกิลติดตัว)
            id: 'merchant_passive_1', name: 'ตาถึง',
            description: 'ได้ GP +50%, 10% ได้ไอเทมเพิ่ม',
            skillTrigger: 'PASSIVE',
            effect: [
                { type: 'LOOT_BONUS_PERCENT', lootType: 'GP', amount: 50 },
                { type: 'PROC_CHANCE', chance: 10, effect: 'EXTRA_LOOT_ITEM' }
            ]
        }
    ],
    'เจ้าเมือง': [
        {
            id: 'lord_battle_command', name: 'บัญชาการรบ',
            description: 'บัฟทีม (เลือก 1: ATK, DEF, Speed) 30% (d6 เทิร์น)',
            targetType: 'teammate_all_self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: {
                type: 'SELECTABLE_STAT_BUFF_PERCENT',
                choices: { 'STR': 'ATK', 'CON': 'DEF', 'DEX': 'Speed' },
                amount: 30,
                durationDice: 'd6'
            }
        },
        {
            id: 'lord_levy_tax', name: 'เรียกเก็บภาษี',
            description: 'ลด ATK/DEF ศัตรู 25% และนำมาเพิ่มให้ตนเอง (d4 เทิร์น)',
            targetType: 'enemy', skillType: 'DEBUFF_BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            successRoll: { check: 'd20', resistStat: 'WIS' },
            effect: {
                type: 'STAT_STEAL_PERCENT',
                stats: [{ stat: 'STR', amount: 25 }, { stat: 'CON', amount: 25 }],
                durationDice: 'd4'
            }
        },
        {
            id: 'lord_call_reinforcements', name: 'เรียกกองกำลัง',
            description: 'เรียก [อัศวินองครักษ์] 2 นาย (จนจบการต่อสู้)',
            targetType: 'self', skillType: 'SUMMON', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PER_COMBAT', uses: 1 },
            effect: {
                type: 'SUMMON',
                unitId: 'royal_guard',
                count: 2,
                duration: -1 // (อยู่จนจบ)
            }
        },
        { // (สกิลติดตัว)
            id: 'lord_passive_1', name: 'บารมีผู้ปกครอง',
            description: 'ออร่า All Stats +10%, GP +100%',
            skillTrigger: 'PASSIVE',
            effect: [
                { type: 'AURA_STAT_PERCENT', stats: ['ALL'], amount: 10 },
                { type: 'LOOT_BONUS_PERCENT', lootType: 'GP', amount: 100 }
            ]
        }
    ],

    // 8. สายนักดาบเวทย์ (อาชีพลับ)
    'นักดาบเวทย์': [
        {
            id: 'magic_swordsman_rune_blade', name: 'ดาบมนตรา',
            description: 'เคลือบอาวุธ (เลือก 1 ธาตุ), โจมตีเพิ่ม %HP (d6 เทิร์น)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 6 },
            effect: {
                type: 'WEAPON_BUFF_ELEMENTAL',
                elements: ['ดิน', 'น้ำ', 'ลม', 'ไฟ', 'น้ำแข็ง', 'สายฟ้า', 'ไม้'],
                durationDice: 'd6',
                buffId: 'MS_RUNE_BLADE_V1' // (d6 + INT_Bonus)*0.10 * TargetCurrentHP
            }
        },
        {
            id: 'magic_swordsman_arcane_slash', name: 'ฟันเวทย์',
            description: 'โจมตีผสม %HP ((dAtk + STR + INT) * 0.15)',
            targetType: 'enemy', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 4 },
            effect: {
                type: 'FORMULA',
                formula: 'MS_ARCANE_SLASH_V1' // ((dWeapon + STR_Bonus + INT_Bonus) * 0.15) * TargetCurrentHP
            }
        },
        { // (สกิลติดตัว)
            id: 'ms_passive_1', name: 'จิตนักรบหลอมรวมเวทย์',
            description: 'ใส่เกราะหนักและร่ายเวทย์ L1 ได้',
            skillTrigger: 'PASSIVE',
            effect: { type: 'ALLOW_EQUIP_AND_CAST', equip: 'HEAVY_ARMOR', cast: 'MAGE_L1' }
        },
        {
            id: 'ms_passive_2', name: 'สมดุลพลัง',
            description: 'เพิ่ม STR และ INT +15%',
            skillTrigger: 'PASSIVE',
            effect: { type: 'PASSIVE_STAT_PERCENT', stats: ['STR', 'INT'], amount: 15 }
        }
    ],
    'จอมดาบมนตรา': [
        {
            id: 'rb_adv_rune_blade', name: 'ดาบมนตราขั้นสูง',
            description: 'เคลือบอาวุธ (เลือก 1 ธาตุ), โจมตี %HP (d6 เทิร์น)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 5 },
            effect: {
                type: 'WEAPON_BUFF_ELEMENTAL',
                elements: ['ดิน', 'น้ำ', 'ลม', 'ไฟ', 'น้ำแข็ง', 'สายฟ้า', 'ไม้'],
                durationDice: 'd6',
                buffId: 'MS_RUNE_BLADE_V2' // (d8 + INT_Bonus)*0.20 * TargetCurrentHP
            }
        },
        {
            id: 'rb_piercing_slash', name: 'ฟันเวทย์ทะลวง',
            description: 'โจมตี %HP ((dAtk + STR + INT) * 0.25), ลด M.DEF 20%',
            targetType: 'enemy', skillType: 'DAMAGE_DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 4 },
            effect: {
                type: 'FORMULA',
                formula: 'MS_ARCANE_SLASH_V2', // ((dWeapon + STR + INT) * 0.25) * TargetCurrentHP
                debuff: { type: 'TEMP_STAT_PERCENT', stat: 'INT', amount: -20, isDebuff: true, durationDice: 'd4' } // (สมมติ M.DEF คือ INT)
            }
        },
        {
            id: 'rb_mana_shield', name: 'เกราะเวทย์',
            description: 'สร้างเกราะดูดซับความเสียหาย (Max MP * 1.5) (3 เทิร์น)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: { type: 'SHIELD', formula: 'MANA_SHIELD_V1', duration: 3 }
        },
        { // (สกิลติดตัว)
            id: 'rb_passive_1', name: 'เชี่ยวชาญศาสตร์ผสมผสาน',
            description: 'ใส่เกราะหนักและร่ายเวทย์ L2 ได้',
            skillTrigger: 'PASSIVE',
            effect: { type: 'ALLOW_EQUIP_AND_CAST', equip: 'HEAVY_ARMOR', cast: 'MAGE_L2' }
        },
        {
            id: 'rb_passive_2', name: 'กายาผสานเวทย์',
            description: 'โจมตีปกติ (ไม่เคลือบ) เป็น %HP ((dAtk + STR + INT) * 0.15)',
            skillTrigger: 'PASSIVE',
            effect: { type: 'FORMULA_ATTACK_OVERRIDE', formula: 'MS_ARCANE_SLASH_V1' }
        }
    ],
    'ราชันย์ดาบเวทย์': [
        {
            id: 'abm_imperial_rune_blade', name: 'ดาบมนตราจักรพรรดิ',
            description: 'เคลือบอาวุธ (เลือก 2 ธาตุ), โจมตี %HP (d6 เทิร์น)',
            targetType: 'self', skillType: 'BUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 4 },
            effect: {
                type: 'WEAPON_BUFF_ELEMENTAL',
                elements: ['ดิน', 'น้ำ', 'ลม', 'ไฟ', 'น้ำแข็ง', 'สายฟ้า', 'ไม้', 'แสง', 'มืด'],
                selectCount: 2,
                durationDice: 'd6',
                buffId: 'MS_RUNE_BLADE_V3' // (d10 + INT_Bonus)*0.30 * TargetCurrentHP
            }
        },
        {
            id: 'abm_spellbreak_sword', name: 'เพลงดาบสะท้อนเวทย์',
            description: 'โจมตี %HP ((d20 + STR + INT) * 0.35), ขัดร่ายเวทย์ (x1.5 Dmg)',
            targetType: 'enemy', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 6 },
            effect: {
                type: 'FORMULA',
                formula: 'MS_ARCANE_SLASH_V3', // ((d20 + STR + INT) * 0.35) * TargetCurrentHP
                bonusVs: { status: ['CASTING'], multiplier: 1.5 },
                statusProc: { status: 'CANCEL_CASTING', chance: 100 }
            }
        },
        {
            id: 'abm_mana_burst', name: 'ปลดปล่อยพลังเวทย์',
            description: 'ระเบิดพลัง AOE %HP ((STR + INT) * 0.50), ผลักกระเด็น',
            targetType: 'enemy_aoe', skillType: 'DAMAGE', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 10 },
            effect: {
                type: 'FORMULA_AOE',
                formula: 'MS_MANA_BURST_V1', // ((STR_Bonus + INT_Bonus) * 0.50) * TargetCurrentHP
                knockback: true
            }
        },
        { // (สกิลติดตัว)
            id: 'abm_passive_1', name: 'ปรมาจารย์ศาสตร์ผสมผสาน',
            description: 'ใส่เกราะหนักและร่ายเวทย์ L3 ได้',
            skillTrigger: 'PASSIVE',
            effect: { type: 'ALLOW_EQUIP_AND_CAST', equip: 'HEAVY_ARMOR', cast: 'MAGE_L3' }
        },
        {
            id: 'abm_passive_2', name: 'กายาผสานเวทย์สูงสุด',
            description: 'โจมตีปกติ (ไม่เคลือบ) เป็น %HP ((dAtk + STR + INT) * 0.25)',
            skillTrigger: 'PASSIVE',
            effect: { type: 'FORMULA_ATTACK_OVERRIDE', formula: 'MS_ARCANE_SLASH_V2' }
        },
        {
            id: 'abm_passive_3', name: 'ดูดซับมานา',
            description: 'โจมตีศัตรูติดธาตุ 30% ฟื้นฟูคูลดาวน์ 1 เทิร์น',
            skillTrigger: 'PASSIVE',
            effect: { type: 'PROC_CHANCE_ON_STATUS', status: 'ELEMENTAL', chance: 30, effect: 'REDUCE_COOLDOWN', turns: 1 }
        }
    ],

    // 9. จอมมาร (อาชีพลับ)
    'จอมมาร': [
        {
            id: 'demon_lord_dark_wave', name: 'คลื่นพลังแห่งความมืด',
            description: 'โจมตี %HP ศัตรูทั้งหมด, 50% ติด [หวาดกลัว]',
            targetType: 'enemy_all', skillType: 'DAMAGE_DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 6 },
            effect: {
                type: 'FORMULA_AOE',
                formula: 'DL_DARK_WAVE', // ((d12 + INT/STR_Bonus) * 0.20) * TargetCurrentHP
                element: 'DARK',
                statusProc: { status: 'FEAR', chance: 50, durationDice: 'd4' }
            }
        },
        {
            id: 'demon_lord_call_abyss', name: 'เสียงเรียกจากขุมนรก',
            description: 'อัญเชิญ [อสูรรับใช้] 2 ตัว (อยู่จนกว่าจะตาย)',
            targetType: 'self', skillType: 'SUMMON', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PERSONAL', turns: 8 },
            effect: {
                type: 'SUMMON',
                unitId: 'abyss_servant',
                count: 2,
                duration: -1
            }
        },
        {
            id: 'demon_lord_dimension_despair', name: 'ห้วงมิติแห่งความสิ้นหวัง',
            description: 'เปลี่ยนสนามรบ: ศัตรูโดน DoT 5% MaxHP, ตัวเองบัฟ 25% (5 เทิร์น)',
            targetType: 'all', skillType: 'FIELD_BUFF_DEBUFF', skillTrigger: 'ACTIVE',
            cooldown: { type: 'PER_COMBAT', uses: 1 },
            effect: {
                type: 'FIELD_EFFECT',
                duration: 5,
                debuff: { // (ผลต่อศัตรู)
                    type: 'DOT',
                    element: 'DARK',
                    damage: 5,
                    damageType: 'PERCENT_MAX_HP',
                    tickOn: 'GLOBAL'
                },
                buff: { // (ผลต่อตัวเอง)
                    type: 'ALL_TEMP_STAT_PERCENT',
                    amount: 25
                }
            }
        },
        { // (สกิลติดตัว)
            id: 'dl_passive_1', name: 'อำนาจจอมมาร (%HP Atk)',
            description: 'โจมตีปกติเป็น %HP ((dAtk + STR/INT) * 0.15)',
            skillTrigger: 'PASSIVE',
            effect: { type: 'FORMULA_ATTACK_OVERRIDE', formula: 'DL_PASSIVE_V1' }
        },
        {
            id: 'dl_passive_2', name: 'อำนาจจอมมาร (ต้านทาน)',
            description: 'ต้านทานเวทย์ศักดิ์สิทธิ์ 50%, ต้านสถานะ 75%',
            skillTrigger: 'PASSIVE',
            effect: [
                { type: 'RESIST_ELEMENT_PERCENT', element: 'HOLY', amount: 50 },
                { type: 'STATUS_RESIST_PERCENT', amount: 75 }
            ]
        },
        {
            id: 'dl_passive_3', name: 'อำนาจจอมมาร (ฟื้นฟู)',
            description: 'ฟื้นฟู 5% MaxHP ทุกเทิร์นตัวเอง',
            skillTrigger: 'PASSIVE',
            effect: { type: 'REGEN_PERCENT', amount: 5, tickOn: 'PERSONAL' }
        }
    ]
};

/**
 * -----------------------------------------------------------------
 * 5. ฐานข้อมูลปฏิกิริยาธาตุ (ข้อ 12 - นักเวท)
 * -----------------------------------------------------------------
 */
const ELEMENT_REACTIONS = {
    // 1. ปฏิกิริยาขยายความเสียหาย (Amplifying Reactions)
    'FIRE': { // (สถานะที่ติดตัว)
        'WATER': { effect: 'Vaporize', multiplier: 1.5, clears: 'FIRE' }, // (ตัวชนวน)
        'ICE': { effect: 'Melt', multiplier: 1.5, clears: 'FIRE' }
    },
    'WATER': {
        'FIRE': { effect: 'Major Vaporize', multiplier: 2.0, clears: 'WATER' }
    },
    'ICE': {
        'FIRE': { effect: 'Major Melt', multiplier: 2.0, clears: 'ICE' }
    },

    // 2. ปฏิกิริยาเปลี่ยนแปลง (Transformative Reactions)
    'WATER+ICE': { effect: 'Freeze', status: 'FROZEN', durationDice: 'd4', clears: ['WATER', 'ICE'] },
    'FROZEN': { // (สถานะพิเศษ)
        'PHYSICAL': { effect: 'Shatter', trueDamageDice: '4d10', clears: 'FROZEN' },
        'EARTH': { effect: 'Shatter', trueDamageDice: '4d10', clears: 'FROZEN' },
        'LIGHTNING': { effect: 'Shatter', trueDamageDice: '4d10', clears: 'FROZEN' }
    },
    'WATER+LIGHTNING': { effect: 'Electro-Charged', status: 'SHOCKED_DOT', duration: 3, damageDice: 'd6%', clears: ['WATER', 'LIGHTNING'] },
    'FIRE+LIGHTNING': { effect: 'Overload', aoeElement: 'FIRE', knockback: true, clears: ['FIRE', 'LIGHTNING'] },
    'ICE+LIGHTNING': { effect: 'Superconduct', aoeElement: 'ICE', debuff: 'DEF_DOWN_40', durationDice: 'd6', clears: ['ICE', 'LIGHTNING'] },
    'FIRE+WOOD': { effect: 'Ignite', status: 'MAJOR_BURN_DOT', durationDice: 'd4', damageDice: 'd10%', clears: ['FIRE', 'WOOD'] },
    'WATER+WOOD': { effect: 'Entangle', status: 'ROOTED', durationDice: 'd4', clears: ['WATER', 'WOOD'] },
    
    // 3. ปฏิกิริยาเสริมสภาพ (Support Reactions)
    'WIND': {
        'FIRE': { effect: 'Swirl (Fire)', spread: 'FIRE', clears: 'FIRE' },
        'WATER': { effect: 'Swirl (Water)', spread: 'WATER', clears: 'WATER' },
        'ICE': { effect: 'Swirl (Ice)', spread: 'ICE', clears: 'ICE' },
        'LIGHTNING': { effect: 'Swirl (Lightning)', spread: 'LIGHTNING', clears: 'LIGHTNING' }
    },
    'EARTH': {
        'FIRE': { effect: 'Crystallize (Fire)', shield: 'FIRE', clears: 'FIRE' },
        'WATER': { effect: 'Crystallize (Water)', shield: 'WATER', clears: 'WATER' },
        'ICE': { effect: 'Crystallize (Ice)', shield: 'ICE', clears: 'ICE' },
        'LIGHTNING': { effect: 'Crystallize (Lightning)', shield: 'LIGHTNING', clears: 'LIGHTNING' }
    },
    
    // 4. ปฏิกิริยาพิเศษ (Special Reactions)
    'LIGHT+DARK': { effect: 'Annihilation', trueDamageDice: '10d20', clears: ['LIGHT', 'DARK'] },
    'HOLY': {
        'DARK': { effect: 'Purify', multiplier: 2.0, status: 'SILENCE', durationDice: 'd4', clears: ['HOLY', 'DARK'] }
    },
    'DARK': {
        'HOLY': { effect: 'Exorcise', multiplier: 2.0, debuff: 'WEAKNESS_25', durationDice: 'd4', clears: ['DARK', 'HOLY'] }
    }
};
