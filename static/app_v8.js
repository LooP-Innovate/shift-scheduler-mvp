let globalStaffList = [];

function initializeStaffGlobal() {
    console.log('Initializing Staff Global Ver 8.0...');
    let staffList = [];
    for (let i = 1; i <= 30; i++) {
        let floor = 1;
        let isLeader = false;
        let isBusiness = false;

        if (i === 1) { floor = 1; isLeader = true; }
        else if (i === 16) { floor = 2; isLeader = true; }
        else if (i === 29 || i === 30) { floor = 3; isBusiness = true; }
        else if (i < 16) { floor = 1; }
        else { floor = 2; }

        staffList.push({
            id: 's' + Date.now() + i,
            name: 'Staff ' + i + (isLeader ? ' (責任者)' : (isBusiness ? ' (業務員)' : '')),
            can_night: (isLeader || isBusiness) ? false : (i <= 28),
            floor: floor,
            restricted_shift: null,
            is_weekday_only: (isLeader || isBusiness)
        });
    }
    // 2 Special staff
    staffList.push({
        id: 's' + Date.now() + 'spec1',
        name: '特定スタッフ A',
        can_night: false,
        floor: 1,
        restricted_shift: '早③',
        is_weekday_only: false
    });
    staffList.push({
        id: 's' + Date.now() + 'spec2',
        name: '特定スタッフ B',
        can_night: false,
        floor: 2,
        restricted_shift: '早③',
        is_weekday_only: false
    });
    globalStaffList = staffList;
    return staffList;
}
window.initializeStaffGlobal = initializeStaffGlobal;

function forceLoadV7() {
    if (window.loadSavedInternal) window.loadSavedInternal();
    else alert('エンジン準備未了');
}
window.forceLoadV7 = forceLoadV7;

document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const saveBtn = document.getElementById('save-btn');
    const exportBtn = document.getElementById('export-btn');
    const addStaffBtn = document.getElementById('add-staff-btn');
    const loadingState = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const scheduleContainer = document.getElementById('schedule-container');
    const scheduleTable = document.getElementById('schedule-table');
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');
    const deleteStaffBtn = document.getElementById('delete-staff-btn');
    const staffTbody = document.getElementById('staff-tbody');
    const staffTotalCountEl = document.getElementById('staff-total-count');
    const staffNightCountEl = document.getElementById('staff-night-count');

    let staffList = [];
    let selectedStaffIndex = -1;

    // Dates
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    for (let y = currentYear - 1; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        if (m === currentMonth) opt.selected = true;
        monthSelect.appendChild(opt);
    }

    [yearSelect, monthSelect].forEach(el => {
        el.addEventListener('change', () => loadSavedSchedule());
    });

    function initializeStaff() {
        staffList = initializeStaffGlobal();
        renderStaffList();
    }

    function renderStaffList() {
        if (!staffTbody) return;
        staffTbody.innerHTML = '';
        staffList.forEach((staff, index) => {
            const tr = document.createElement('tr');
            if (index === selectedStaffIndex) tr.classList.add('selected-row');
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
                selectedStaffIndex = index;
                renderStaffList();
            });

            // Name
            const tdName = document.createElement('td');
            const inputName = document.createElement('input');
            inputName.type = 'text'; inputName.value = staff.name; inputName.className = 'staff-input';
            inputName.addEventListener('change', (e) => {
                const oldName = staffList[index].name;
                const newName = e.target.value.trim();
                staffList[index].name = newName;
                if (window.currentScheduleData) {
                    const existing = window.currentScheduleData.find(ex => ex.staff_id === oldName);
                    if (existing) existing.staff_id = newName;
                }
                if (window.globalFixedMask && window.globalFixedMask[oldName]) {
                    window.globalFixedMask[newName] = window.globalFixedMask[oldName];
                    delete window.globalFixedMask[oldName];
                }
                syncScheduleTable();
            });
            tdName.appendChild(inputName);

            // Floor
            const tdFloor = document.createElement('td');
            const selectFloor = document.createElement('select');
            selectFloor.className = 'staff-input';
            [1, 2, 3].forEach(f => {
                const opt = document.createElement('option');
                opt.value = f; opt.textContent = f === 3 ? '業務員' : f + '階';
                if (staff.floor === f) opt.selected = true;
                selectFloor.appendChild(opt);
            });
            selectFloor.addEventListener('change', (e) => {
                staffList[index].floor = parseInt(e.target.value, 10);
                syncScheduleTable();
            });
            tdFloor.appendChild(selectFloor);

            // Weekday
            const tdWeekday = document.createElement('td');
            const inputWeekday = document.createElement('input');
            inputWeekday.type = 'checkbox'; inputWeekday.checked = staff.is_weekday_only;
            inputWeekday.addEventListener('change', (e) => staffList[index].is_weekday_only = e.target.checked);
            tdWeekday.appendChild(inputWeekday);

            // Night
            const tdNight = document.createElement('td');
            const inputNight = document.createElement('input');
            inputNight.type = 'checkbox'; inputNight.checked = staff.can_night;
            inputNight.addEventListener('change', (e) => staffList[index].can_night = e.target.checked);
            tdNight.appendChild(inputNight);

            // Order
            const tdOrder = document.createElement('td');
            const btnUp = document.createElement('button');
            btnUp.className = 'btn-text'; btnUp.innerHTML = '▲'; 
            btnUp.disabled = (index === 0);
            btnUp.addEventListener('click', (e) => {
                e.stopPropagation();
                [staffList[index], staffList[index-1]] = [staffList[index-1], staffList[index]];
                selectedStaffIndex = index - 1; globalStaffList = staffList;
                renderStaffList(); syncScheduleTable();
            });
            const btnDown = document.createElement('button');
            btnDown.className = 'btn-text'; btnDown.innerHTML = '▼';
            btnDown.disabled = (index === staffList.length - 1);
            btnDown.addEventListener('click', (e) => {
                e.stopPropagation();
                [staffList[index], staffList[index+1]] = [staffList[index+1], staffList[index]];
                selectedStaffIndex = index + 1; globalStaffList = staffList;
                renderStaffList(); syncScheduleTable();
            });
            tdOrder.appendChild(btnUp); tdOrder.appendChild(btnDown);

            tr.appendChild(tdName); tr.appendChild(tdFloor); tr.appendChild(tdWeekday); tr.appendChild(tdNight); tr.appendChild(tdOrder);
            staffTbody.appendChild(tr);
        });
        updateStaffCounts();
    }

    function syncScheduleTable() {
        if (!window.currentScheduleData) return;
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const numDays = new Date(year, month, 0).getDate();
        const newSchedule = staffList.map(s => {
            const existing = window.currentScheduleData.find(ex => ex.staff_id === s.name);
            if (existing) { existing.floor = s.floor; return existing; }
            return { staff_id: s.name, floor: s.floor, shifts: new Array(numDays).fill('') };
        });
        window.currentScheduleData = newSchedule;
        renderScheduleTable(newSchedule, numDays);
    }

    function updateStaffCounts() {
        if (staffTotalCountEl) staffTotalCountEl.textContent = staffList.length;
        if (staffNightCountEl) staffNightCountEl.textContent = staffList.filter(s => s.can_night).length;
    }

    addStaffBtn.addEventListener('click', () => {
        staffList.push({ id: 's'+Date.now(), name: 'Staff '+(staffList.length+1), can_night: true, floor: 2, restricted_shift: null, is_weekday_only: false });
        selectedStaffIndex = staffList.length - 1;
        globalStaffList = staffList; renderStaffList(); syncScheduleTable();
        const container = document.querySelector('.staff-list-container');
        if (container) container.scrollTop = container.scrollHeight;
    });

    deleteStaffBtn.addEventListener('click', () => {
        if (selectedStaffIndex === -1) { alert('行を選択してください'); return; }
        if (confirm('削除しますか？')) {
            staffList.splice(selectedStaffIndex, 1);
            selectedStaffIndex = -1; globalStaffList = staffList;
            renderStaffList(); syncScheduleTable();
        }
    });

    function resetScheduleToEmpty(confirmed = true) {
        if (confirmed) {
            if (!confirm('現在の勤務表を空にしてよろしいですか？（保存されているデータは消えません）')) return;
        }
        
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const numDays = new Date(year, month, 0).getDate();

        const emptyData = staffList.map(s => ({
            staff_id: s.name,
            floor: s.floor,
            shifts: new Array(numDays).fill('')
        }));

        window.globalFixedMask = {}; 
        window.currentScheduleData = emptyData;
        renderScheduleTable(emptyData, numDays);
        
        scheduleContainer.classList.remove('hidden');
        saveBtn.classList.remove('hidden');
        exportBtn.classList.remove('hidden');
        errorMessage.classList.add('hidden');
    }

    resetBtn.addEventListener('click', () => {
        resetScheduleToEmpty(true);
    });

    async function loadSavedSchedule() {
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        scheduleTable.innerHTML = ''; scheduleContainer.classList.add('hidden');
        saveBtn.classList.add('hidden'); exportBtn.classList.add('hidden'); errorMessage.classList.add('hidden');
        try {
            const response = await fetch(`/api/load?year=${year}&month=${month}`);
            const data = await response.json();
            if (data.status === 'success' && data.schedule) {
                const numDays = new Date(year, month, 0).getDate();
                window.globalFixedMask = {}; 
                
                // Auto-correct old saved data where business staff were forced to floor 2
                data.schedule.forEach(s => {
                    if (s.staff_id.includes('業務員')) s.floor = 3;
                });
                
                renderScheduleTable(data.schedule, numDays);
                staffList = data.schedule.map(s => {
                    const existingGlobal = globalStaffList.find(gs => gs.name === s.staff_id);
                    return {
                        id: 's' + Date.now() + Math.random(), name: s.staff_id, floor: s.floor,
                        can_night: existingGlobal ? existingGlobal.can_night : true,
                        restricted_shift: existingGlobal ? existingGlobal.restricted_shift : null,
                        is_weekday_only: existingGlobal ? existingGlobal.is_weekday_only : false
                    };
                });
                renderStaffList();
                scheduleContainer.classList.remove('hidden'); saveBtn.classList.remove('hidden'); exportBtn.classList.remove('hidden');
            }
        } catch (e) { console.error(e); }
    }
    window.loadSavedInternal = loadSavedSchedule;

    saveBtn.addEventListener('click', async () => {
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const schedule = [];
        const rows = scheduleTable.querySelectorAll('tbody tr:not(.summary-row)');
        let currentFloor = 1;
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 1) {
                const text = cells[0].textContent;
                if (text.includes('1階')) currentFloor = 1; else if (text.includes('2階')) currentFloor = 2; else if (text.includes('業務員')) currentFloor = 3;
                return;
            }
            if (cells.length < 2) return;
            const shifts = []; row.querySelectorAll('select').forEach(sel => shifts.push(sel.value));
            schedule.push({ staff_id: cells[0].textContent, floor: currentFloor, shifts: shifts });
        });
        try {
            const response = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month, schedule }) });
            if (response.ok) alert('保存しました');
        } catch (e) { alert('保存失敗'); }
    });

    exportBtn.addEventListener('click', async () => {
        const schedule = [];
        const rows = scheduleTable.querySelectorAll('tbody tr:not(.summary-row)');
        let currentFloor = 1;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 1) {
                const text = cells[0].textContent;
                if (text.includes('1階')) currentFloor = 1;
                else if (text.includes('2階')) currentFloor = 2;
                else if (text.includes('業務員')) currentFloor = 3;
                return;
            }
            if (cells.length < 2) return;
            const staffId = cells[0].textContent;
            const shifts = [];
            row.querySelectorAll('select').forEach(sel => shifts.push(sel.value));
            schedule.push({ staff_id: staffId, floor: currentFloor, shifts: shifts });
        });

        try {
            exportBtn.disabled = true;
            const year = parseInt(yearSelect.value);
            const month = parseInt(monthSelect.value);
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schedule,
                    year,
                    month,
                    num_days: new Date(year, month, 0).getDate()
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Export failed');
            if (data.file_id) {
                const a = document.createElement('a');
                a.href = `/api/download/${data.file_id}`;
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                throw new Error('No file_id returned');
            }
        } catch (e) {
            console.error(e);
            alert('Excelの出力に失敗しました: ' + e.message);
        } finally {
            exportBtn.disabled = false;
        }
    });

    generateBtn.addEventListener('click', async () => {
        const year = parseInt(yearSelect.value); const month = parseInt(monthSelect.value);
        if (staffList.length === 0) return;
        const currentShifts = [];
        const rows = scheduleTable.querySelectorAll('tbody tr:not(.summary-row)');
        let currentFloor = 1;
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 1) {
                const text = cells[0].textContent;
                if (text.includes('1階')) currentFloor = 1; else if (text.includes('2階')) currentFloor = 2; else if (text.includes('業務員')) currentFloor = 3;
                return;
            }
            if (cells.length < 2) return;
            const staffId = cells[0].textContent; const shifts = []; let dIdx = 0;
            row.querySelectorAll('select').forEach(sel => {
                const isFixed = window.globalFixedMask && window.globalFixedMask[staffId] && window.globalFixedMask[staffId][dIdx];
                shifts.push(isFixed ? sel.value : ''); dIdx++;
            });
            currentShifts.push({ staff_id: staffId, floor: currentFloor, shifts: shifts });
        });

        generateBtn.disabled = true; 
        loadingState.classList.remove('hidden'); 
        scheduleContainer.classList.add('hidden'); // Clear previous result immediately
        window.currentScheduleData = null;
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
        errorMessage.style.backgroundColor = ''; // Reset to CSS default (red)
        errorMessage.style.color = '';
        errorMessage.style.border = '';

        try {
            const prevYear = month === 1 ? year - 1 : year; const prevMonth = month === 1 ? 12 : month - 1;
            let previousShifts = {}; let previousHolidayCounts = {};
            try {
                const prevResp = await fetch(`/api/load?year=${prevYear}&month=${prevMonth}`);
                const prevData = await prevResp.json();
                if (prevData.status === 'success' && prevData.schedule) {
                    prevData.schedule.forEach(s => {
                        const sid = s.staff_id.trim(); previousShifts[sid] = s.shifts.slice(-3);
                        let c = 0; s.shifts.forEach(sh => { if (sh === '休') c += 1; else if (sh === '明け') c += 0.5; });
                        previousHolidayCounts[sid] = c;
                    });
                }
            } catch (e) {}

            const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year, month, staff_list: staffList, previous_shifts: previousShifts, previous_holiday_counts: previousHolidayCounts, current_shifts: currentShifts }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || '自動生成に失敗しました');
            
            if (data.status === 'error' || data.status === 'failed') {
                throw new Error(data.message);
            }

            renderScheduleTable(data.schedule, new Date(year, month, 0).getDate());
            
            loadingState.classList.add('hidden'); 
            scheduleContainer.classList.remove('hidden'); 
            saveBtn.classList.remove('hidden'); 
            exportBtn.classList.remove('hidden');

            if (data.status === 'provisional' || (data.holes && data.holes.length > 0)) {
                let alertMsg = '【注意：人員不足による暫定案】\n必須シフトが一部埋まりませんでしたが、安全制約を守った範囲での最善案を作成しました。\n以下の不足箇所を人間が手動で調整してください：\n\n';
                if (data.holes) {
                    data.holes.forEach(h => {
                        alertMsg += `・${h.day}日 (${h.floor === 3 ? '業務員' : h.floor + '階'}) ${h.shift}: ${h.count}名不足\n`;
                    });
                }
                alert(alertMsg);
                errorMessage.textContent = '⚠️ 必須シフトに不足がある「暫定案」です。手動での調整が必要です。';
                errorMessage.classList.remove('hidden');
                errorMessage.style.backgroundColor = '#fff7ed'; // Light orange background for warning
                errorMessage.style.color = '#9a3412';
                errorMessage.style.border = '1px solid #fdba74';
            }
        } catch (error) { 
            loadingState.classList.add('hidden'); 
            errorMessage.textContent = 'エラー: ' + error.message; 
            errorMessage.classList.remove('hidden');
            alert('【エラー】\n' + error.message);
        } finally { generateBtn.disabled = false; }
    });

    function renderScheduleTable(scheduleData, numDays) {
        if (!scheduleData) return;
        window.currentScheduleData = scheduleData;
        const SHIFTS = ['', '休', '早②', '早③', '日', '遅①', '遅②', '夜①', '夜②', '明け', '病休', '欠勤'];
        const year = parseInt(yearSelect.value); const month = parseInt(monthSelect.value);
        scheduleTable.innerHTML = '';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const nameH = document.createElement('th'); nameH.textContent = '名前'; headerRow.appendChild(nameH);
        
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        
        for (let d = 1; d <= numDays; d++) {
            const dateObj = new Date(year, month - 1, d);
            const wIdx = dateObj.getDay();
            const wStr = weekdays[wIdx];
            
            const th = document.createElement('th'); 
            th.innerHTML = `${d}<br><span style="font-size:0.7em; color: ${wIdx===0 ? '#ef4444' : (wIdx===6 ? '#3b82f6' : 'inherit')}">(${wStr})</span>`;
            headerRow.appendChild(th);
        }

        const summaryCols = ['合計', '公休', '早②', '早③', '日', '遅①', '遅②'];
        summaryCols.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow); scheduleTable.appendChild(thead);
        const tbody = document.createElement('tbody');
        const SUMMARY_SHIFTS = ['早②', '早③', '日', '遅①', '遅②', '夜勤合計'];
        [1, 2, 3].forEach(fNum => {
            let filtered = scheduleData.filter(s => s.floor === fNum);
            if (filtered.length === 0) return;
            const floorHeader = document.createElement('tr'); const floorCell = document.createElement('td'); 
            floorCell.colSpan = numDays + 1 + summaryCols.length;
            floorCell.style.background = '#f1f5f9'; floorCell.textContent = fNum === 3 ? '業務員' : fNum + '階';
            floorHeader.appendChild(floorCell); tbody.appendChild(floorHeader);
            filtered.forEach(staff => {
                const tr = document.createElement('tr'); const nameTd = document.createElement('td'); nameTd.textContent = staff.staff_id; tr.appendChild(nameTd);
                if (!window.globalFixedMask) window.globalFixedMask = {}; if (!window.globalFixedMask[staff.staff_id]) window.globalFixedMask[staff.staff_id] = new Array(numDays).fill(false);
                staff.shifts.forEach((shift, dIdx) => {
                    const td = document.createElement('td'); const sel = document.createElement('select'); sel.className = 'shift-select val-' + shift;
                    if (window.globalFixedMask[staff.staff_id][dIdx] && shift !== '') { td.classList.add('fixed-cell'); sel.classList.add('fixed-shift'); }
                    SHIFTS.forEach(s => { const opt = document.createElement('option'); opt.value = s; opt.textContent = s || '-'; if (s === shift) opt.selected = true; sel.appendChild(opt); });
                    
                    sel.addEventListener('change', () => { 
                        staff.shifts[dIdx] = sel.value; 
                        window.globalFixedMask[staff.staff_id][dIdx] = (sel.value !== ''); 
                        sel.className = 'shift-select val-' + sel.value;
                        if (sel.value !== '') {
                            td.classList.add('fixed-cell'); sel.classList.add('fixed-shift');
                        } else {
                            td.classList.remove('fixed-cell'); sel.classList.remove('fixed-shift');
                        }
                        updateStats();
                        updateDailyTotals();
                    });

                    const toggleFixed = (e) => {
                        e.preventDefault();
                        if (sel.value === '') return;
                        const isFixed = window.globalFixedMask[staff.staff_id][dIdx];
                        window.globalFixedMask[staff.staff_id][dIdx] = !isFixed;
                        if (!isFixed) {
                            td.classList.add('fixed-cell'); sel.classList.add('fixed-shift');
                        } else {
                            td.classList.remove('fixed-cell'); sel.classList.remove('fixed-shift');
                        }
                    };
                    sel.addEventListener('dblclick', toggleFixed);
                    sel.addEventListener('contextmenu', toggleFixed);

                    td.appendChild(sel); tr.appendChild(td);
                });

                // Summary and Stats Cells
                const statsCells = {};
                summaryCols.forEach(key => {
                    const td = document.createElement('td');
                    td.style.fontWeight = 'bold';
                    tr.appendChild(td);
                    statsCells[key] = td;
                });

                const updateStats = () => {
                    let totalH = 0; let totalKyu = 0;
                    let counts = { '早②': 0, '早③': 0, '日': 0, '遅①': 0, '遅②': 0 };
                    staff.shifts.forEach(s => {
                        if (['早②', '早③', '日', '遅①', '遅②'].includes(s)) totalH += 8;
                        if (['夜①', '夜②'].includes(s)) totalH += 12;
                        if (s === '休') totalKyu += 1;
                        if (s === '明け') totalKyu += 0.5;
                        if (counts[s] !== undefined) counts[s]++;
                    });
                    statsCells['合計'].textContent = `${totalH}h`;
                    statsCells['公休'].textContent = `${totalKyu}日`;
                    ['早②', '早③', '日', '遅①', '遅②'].forEach(k => { statsCells[k].textContent = counts[k]; });
                };
                updateStats();

                tbody.appendChild(tr);
            });
        });
        scheduleTable.appendChild(tbody);

        // Daily Summary Footer
        const tfoot = document.createElement('tfoot');
        const dailySummaryCells = {};
        SUMMARY_SHIFTS.forEach(shiftLabel => {
            const tr = document.createElement('tr'); tr.className = 'summary-row';
            const labelTd = document.createElement('td'); labelTd.textContent = shiftLabel + ' 合計';
            labelTd.style.fontWeight = 'bold'; labelTd.style.backgroundColor = '#f8fafc';
            tr.appendChild(labelTd);
            dailySummaryCells[shiftLabel] = [];
            for (let d = 0; d < numDays; d++) {
                const td = document.createElement('td'); td.className = 'summary-cell';
                tr.appendChild(td); dailySummaryCells[shiftLabel].push(td);
            }
            // pad summary cols
            for (let i = 0; i < summaryCols.length; i++) {
                const td = document.createElement('td'); td.style.backgroundColor = '#f8fafc';
                tr.appendChild(td);
            }
            tfoot.appendChild(tr);
        });
        scheduleTable.appendChild(tfoot);

        const updateDailyTotals = () => {
            for (let d = 0; d < numDays; d++) {
                const counts = { '早②': 0, '早③': 0, '日': 0, '遅①': 0, '遅②': 0, '夜勤合計': 0 };
                scheduleData.forEach(stf => {
                    const s = stf.shifts[d];
                    if (counts[s] !== undefined) counts[s]++;
                    if (s === '夜①' || s === '夜②') counts['夜勤合計']++;
                });
                SUMMARY_SHIFTS.forEach(sh => {
                    const cell = dailySummaryCells[sh][d];
                    cell.textContent = counts[sh] || '';
                    cell.style.color = (counts[sh] === 0) ? '#cbd5e1' : 'inherit';
                });
            }
        };
        updateDailyTotals();
    }

    initializeStaff();
    // Default to empty schedule on load instead of auto-loading saved data
    resetScheduleToEmpty(false); 
});
