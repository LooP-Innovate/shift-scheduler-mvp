let globalStaffList = [];

function initializeStaffGlobal() {
    console.log('Initializing Staff Global...');
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

function forceResetV7() {
    console.log('--- GLOBAL RESET START V7.4 ---');
    try {
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');
        if (!yearSelect || !monthSelect) {
            console.error('Select elements not found');
            return;
        }

        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const numDays = new Date(year, month, 0).getDate();

        if (globalStaffList.length === 0) {
            console.log('globalStaffList is empty. Initializing now...');
            initializeStaffGlobal();
        }

        // Create empty schedule data from current globalStaffList
        const emptyData = globalStaffList.map(s => ({
            staff_id: s.name,
            floor: s.floor,
            shifts: new Array(numDays).fill('')
        }));

        console.log('Empty Data Created:', emptyData);

        window.globalFixedMask = {}; // Reset manual overrides

        if (window.renderInternal) {
            window.renderInternal(emptyData, numDays);
            document.getElementById('schedule-container').classList.remove('hidden');
            document.getElementById('save-btn').classList.remove('hidden');
            document.getElementById('export-btn').classList.remove('hidden');
            document.getElementById('error-message').classList.add('hidden');
            console.log('--- GLOBAL RESET END V7.4 ---');
        } else {
            console.error('renderInternal not found');
            alert('描画エンジンがまだ準備できていません。一旦リロードしてください。');
        }
    } catch (err) {
        console.error('Global Reset Error:', err);
        alert('エラーが発生しました: ' + err.message);
    }
}
window.forceResetV7 = forceResetV7;

function forceLoadV7() {
    console.log('--- GLOBAL LOAD START V7 ---');
    if (window.loadSavedInternal) {
        window.loadSavedInternal();
    } else {
        alert('読み込みエンジンが準備できていません');
    }
}
window.forceLoadV7 = forceLoadV7;
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

    // --- State ---
    let staffList = [];
    let selectedStaffIndex = -1;

    // --- Initialization ---
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    for (let y = currentYear - 1; y <= currentYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
    for (let m = 1; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === currentMonth) opt.selected = true;
        monthSelect.appendChild(opt);
    }

    [yearSelect, monthSelect].forEach(el => {
        el.addEventListener('change', () => {
            loadSavedSchedule();
        });
    });

    // Initialize staff
    function initializeStaff() {
        staffList = initializeStaffGlobal();
        renderStaffList();
    }

    // --- Render Staff ---
    function renderStaffList() {
        if (!staffTbody) return;
        staffTbody.innerHTML = '';

        staffList.forEach((staff, index) => {
            const tr = document.createElement('tr');
            if (index === selectedStaffIndex) {
                tr.classList.add('selected-row');
            }
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', (e) => {
                // Don't select if clicking inputs
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') return;
                selectedStaffIndex = index;
                renderStaffList();
            });

            // Name Input
            const tdName = document.createElement('td');
            const inputName = document.createElement('input');
            inputName.type = 'text';
            inputName.value = staff.name;
            inputName.className = 'staff-input';
            inputName.style.width = '100%'; 
            inputName.addEventListener('change', (e) => {
                staffList[index].name = e.target.value.trim();
                syncScheduleTable();
            });
            tdName.appendChild(inputName);

            // Floor Selection
            const tdFloor = document.createElement('td');
            const selectFloor = document.createElement('select');
            selectFloor.className = 'staff-input';
            selectFloor.style.width = '100%';
            [1, 2].forEach(f => {
                const opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f + 'F';
                if (staff.floor === f) opt.selected = true;
                selectFloor.appendChild(opt);
            });
            selectFloor.addEventListener('change', (e) => {
                const newFloor = parseInt(e.target.value, 10);
                staffList[index].floor = newFloor;
                syncScheduleTable();
            });
            tdFloor.appendChild(selectFloor);

            // Weekday Only Checkbox
            const tdWeekday = document.createElement('td');
            const inputWeekday = document.createElement('input');
            inputWeekday.type = 'checkbox';
            inputWeekday.checked = staff.is_weekday_only;
            inputWeekday.addEventListener('change', (e) => {
                staffList[index].is_weekday_only = e.target.checked;
            });
            tdWeekday.appendChild(inputWeekday);
            tdWeekday.style.textAlign = 'center';

            // Night Checkbox
            const tdNight = document.createElement('td');
            const inputNight = document.createElement('input');
            inputNight.type = 'checkbox';
            inputNight.checked = staff.can_night;
            inputNight.addEventListener('change', (e) => {
                staffList[index].can_night = e.target.checked;
            });
            tdNight.appendChild(inputNight);
            tdNight.style.textAlign = 'center';

            // Order Actions
            const tdOrder = document.createElement('td');
            tdOrder.style.whiteSpace = 'nowrap';
            tdOrder.style.textAlign = 'center';
            
            // Move Up
            const btnUp = document.createElement('button');
            btnUp.className = 'btn-text';
            btnUp.title = '上に移動';
            btnUp.innerHTML = '▲';
            btnUp.disabled = (index === 0);
            btnUp.addEventListener('click', (e) => {
                e.stopPropagation();
                const temp = staffList[index];
                staffList[index] = staffList[index - 1];
                staffList[index - 1] = temp;
                selectedStaffIndex = index - 1;
                globalStaffList = staffList;
                renderStaffList();
                syncScheduleTable();
            });
            
            // Move Down
            const btnDown = document.createElement('button');
            btnDown.className = 'btn-text';
            btnDown.title = '下に移動';
            btnDown.innerHTML = '▼';
            btnDown.disabled = (index === staffList.length - 1);
            btnDown.addEventListener('click', (e) => {
                e.stopPropagation();
                const temp = staffList[index];
                staffList[index] = staffList[index + 1];
                staffList[index + 1] = temp;
                selectedStaffIndex = index + 1;
                globalStaffList = staffList;
                renderStaffList();
                syncScheduleTable();
            });

            tdOrder.appendChild(btnUp);
            tdOrder.appendChild(btnDown);

            tr.appendChild(tdName);
            tr.appendChild(tdFloor);
            tr.appendChild(tdWeekday);
            tr.appendChild(tdNight);
            tr.appendChild(tdOrder);

            staffTbody.appendChild(tr);
        });

        updateStaffCounts();
    }

    function syncScheduleTable() {
        if (!window.currentScheduleData || !window.renderInternal) return;
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const numDays = new Date(year, month, 0).getDate();

        // Create new schedule data respecting the staffList order
        const newSchedule = staffList.map(s => {
            const existing = window.currentScheduleData.find(ex => ex.staff_id === s.name);
            if (existing) {
                existing.floor = s.floor; // Sync floor
                return existing;
            }
            return {
                staff_id: s.name,
                floor: s.floor,
                shifts: new Array(numDays).fill('')
            };
        });

        window.currentScheduleData = newSchedule;
        window.renderInternal(newSchedule, numDays);
    }

    function updateStaffCounts() {
        const total = staffList.length;
        const night = staffList.filter(s => s.can_night).length;
        if (staffTotalCountEl) staffTotalCountEl.textContent = total;
        if (staffNightCountEl) staffNightCountEl.textContent = night;
    }

    // --- Add Staff ---
    addStaffBtn.addEventListener('click', () => {
        const newStaffName = 'Staff ' + (staffList.length + 1);
        const newStaff = {
            id: 's' + Date.now(),
            name: newStaffName,
            can_night: true,
            floor: 2, // Default to 2F
            restricted_shift: null,
            is_weekday_only: false
        };
        staffList.push(newStaff);
        selectedStaffIndex = staffList.length - 1; // Select new one

        globalStaffList = staffList;
        renderStaffList();
        syncScheduleTable();
        
        // Scroll to bottom of list
        const container = document.querySelector('.staff-list-container');
        if (container) container.scrollTop = container.scrollHeight;
    });

    // --- Delete Staff ---
    deleteStaffBtn.addEventListener('click', () => {
        if (selectedStaffIndex === -1) {
            alert('削除する行をクリックして選択してください。');
            return;
        }
        const staff = staffList[selectedStaffIndex];
        if (confirm(`${staff.name} さんを削除してもよろしいですか？`)) {
            staffList.splice(selectedStaffIndex, 1);
            selectedStaffIndex = -1;
            globalStaffList = staffList;
            renderStaffList();
            syncScheduleTable();
        }
    });

    // --- Reset Schedule ---
    // (Disabled local listener, using global forceResetV5 instead)
    /*
    resetBtn.addEventListener('click', () => {
        ...
    });
    */

    // --- Export to Excel ---
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

            const staffId = cells[0].textContent;
            const shifts = [];
            row.querySelectorAll('select').forEach(select => {
                shifts.push(select.value);
            });

            schedule.push({
                staff_id: staffId,
                floor: currentFloor,
                shifts: shifts
            });
        });

        try {
            exportBtn.disabled = true;
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    schedule,
                    year: parseInt(yearSelect.value),
                    month: parseInt(monthSelect.value),
                    num_days: schedule[0].shifts.length
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Export failed');
            if (data.file_id) {
                // Trigger direct browser download using a temporary link
                // This is the most reliable way to ensure it goes to the "Downloads" folder
                const downloadUrl = `/api/download/${data.file_id}`;
                const a = document.createElement('a');
                a.href = downloadUrl;
                // Note: The filename is actually controlled by the server's Content-Disposition header
                // but setting it here doesn't hurt.
                a.download = '';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                throw new Error('No file_id returned');
            }
        } catch (e) {
            console.error(e);
            alert('Excelの出力に失敗しました。');
        } finally {
            exportBtn.disabled = false;
        }
    });

    // --- Persistence (Save/Load) ---
    async function loadSavedSchedule() {
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);

        scheduleTable.innerHTML = '';
        scheduleContainer.classList.add('hidden');
        saveBtn.classList.add('hidden');
        exportBtn.classList.add('hidden');
        errorMessage.classList.add('hidden');

        try {
            const response = await fetch(`/api/load?year=${year}&month=${month}`);
            const data = await response.json();

            if (data.status === 'success' && data.schedule) {
                const numDays = new Date(year, month, 0).getDate();
                // Do NOT auto-fix shifts on load. Fixed shifts should only be set manually.
                window.globalFixedMask = {}; 

                renderScheduleTable(data.schedule, numDays);

                // --- Sync staffList with loaded data ---
                staffList = data.schedule.map(s => {
                    const existingGlobal = globalStaffList.find(gs => gs.name === s.staff_id);
                    return {
                        id: existingGlobal ? existingGlobal.id : 's' + Date.now() + Math.random(),
                        name: s.staff_id,
                        floor: s.floor,
                        can_night: existingGlobal ? existingGlobal.can_night : true,
                        restricted_shift: existingGlobal ? existingGlobal.restricted_shift : null,
                        is_weekday_only: existingGlobal ? existingGlobal.is_weekday_only : false
                    };
                });
                renderStaffList();

                scheduleContainer.classList.remove('hidden');
                saveBtn.classList.remove('hidden');
                exportBtn.classList.remove('hidden');

            } else {
                alert('保存されたデータが見つかりません。');
            }
        } catch (e) {
            console.error('Failed to load schedule:', e);
            alert('データの読み込みに失敗しました。');
        }
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
                if (text.includes('1階')) currentFloor = 1;
                else if (text.includes('2階')) currentFloor = 2;
                else if (text.includes('業務員')) currentFloor = 3;
                return;
            }
            if (cells.length < 2) return; // Skip empty/invalid

            const staffId = cells[0].textContent;
            const shifts = [];
            row.querySelectorAll('select').forEach(sel => shifts.push(sel.value));
            schedule.push({ staff_id: staffId, floor: currentFloor, shifts: shifts });
        });

        try {
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, month, schedule })
            });
            if (!response.ok) throw new Error('Save failed');
            alert('勤務表を保存しました。');
        } catch (e) {
            console.error(e);
            alert('保存に失敗しました。');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="btn-icon">💾</span> 保存 (確定)';
        }
    });

    // --- Generate Schedule ---
    generateBtn.addEventListener('click', async () => {
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);

        if (staffList.length === 0) {
            alert('スタッフを1名以上追加してください。');
            return;
        }

        // Scrape current table for fixed shifts
        const currentShifts = [];
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
            let dayIndex = 0;
            row.querySelectorAll('select').forEach(sel => {
                const isFixed = window.globalFixedMask && window.globalFixedMask[staffId] && window.globalFixedMask[staffId][dayIndex];
                shifts.push(isFixed ? sel.value : ''); // Only send fixed (manual) shifts
                dayIndex++;
            });
            currentShifts.push({ staff_id: staffId, floor: currentFloor, shifts: shifts });
        });

        generateBtn.disabled = true;
        loadingState.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        // Don't clear table, just hide if not visible
        if (scheduleContainer.classList.contains('hidden')) {
            scheduleTable.innerHTML = '';
        }

        try {
            // Continuity Logic
            const prevYear = month === 1 ? year - 1 : year;
            const prevMonth = month === 1 ? 12 : month - 1;
            let previousShifts = {};
            let previousHolidayCounts = {};

            try {
                const prevResp = await fetch(`/api/load?year=${prevYear}&month=${prevMonth}`);
                const prevData = await prevResp.json();
                if (prevData.status === 'success' && prevData.schedule) {
                    prevData.schedule.forEach(s => {
                        const staffId = s.staff_id.trim();
                        previousShifts[staffId] = s.shifts.slice(-3);

                        // Calculate total holiday count for the previous month
                        let count = 0;
                        s.shifts.forEach(shift => {
                            if (shift === '休') count += 1.0;
                            else if (shift === '明け') count += 0.5;
                        });
                        previousHolidayCounts[staffId] = count;
                    });
                }
            } catch (e) {
                console.warn('Prev month load failed (continuity skipped)', e);
            }

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    year: year,
                    month: month,
                    staff_list: staffList,
                    previous_shifts: previousShifts,
                    previous_holiday_counts: previousHolidayCounts,
                    current_shifts: currentShifts
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || '生成失敗');

            const numDays = new Date(year, month, 0).getDate();
            renderScheduleTable(data.schedule, numDays);

            loadingState.classList.add('hidden');
            scheduleContainer.classList.remove('hidden');
            saveBtn.classList.remove('hidden');
            exportBtn.classList.remove('hidden');
        } catch (error) {
            console.error('Generation Error:', error);
            loadingState.classList.add('hidden');
            errorMessage.textContent = 'エラー: ' + error.message;
            errorMessage.classList.remove('hidden');
            alert('スケジュールの生成中にエラーが発生しました:\n' + error.message);
        } finally {
            generateBtn.disabled = false;
        }
    });

    function renderScheduleTable(scheduleData, numDays) {
        window.currentScheduleData = scheduleData; // Keep track for sync
        console.log('Rendering table...', scheduleData);
        const SHIFTS = ['', '休', '早②', '早③', '日', '遅①', '遅②', '夜①', '夜②', '明け', '病休', '欠勤'];
        const SUMMARY_SHIFTS = ['早②', '早③', '日', '遅①', '遅②', '夜勤合計'];

        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);

        scheduleTable.innerHTML = '';
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        const nameHeader = document.createElement('th');
        nameHeader.textContent = '名前';
        headerRow.appendChild(nameHeader);

        for (let d = 1; d <= numDays; d++) {
            const th = document.createElement('th');
            const dateObj = new Date(year, month - 1, d);
            const dayOfWeek = weekdays[dateObj.getDay()];
            th.innerHTML = `${d}<br><small>(${dayOfWeek})</small>`;
            if (dateObj.getDay() === 0) th.classList.add('sun');
            if (dateObj.getDay() === 6) th.classList.add('sat');
            headerRow.appendChild(th);
        }

        const summaryCols = ['合計', '公休', '早②', '早③', '日勤', '遅①', '遅②'];
        summaryCols.forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        scheduleTable.appendChild(thead);

        const tbody = document.createElement('tbody');
        [1, 2, 3].forEach(floorNum => {
            let filtered = scheduleData.filter(s => s.floor === floorNum);
            if (filtered.length === 0) return;

            // Preserve order from staffList (Manual Reordering)
            const orderedFiltered = [];
            staffList.forEach(s => {
                const found = filtered.find(f => f.staff_id === s.name);
                if (found) orderedFiltered.push(found);
            });
            filtered = orderedFiltered;

            const floorHeader = document.createElement('tr');
            const floorCell = document.createElement('td');
            floorCell.colSpan = numDays + 8; // Name + numDays + 2 (Summary) + 5 (Shift Stats)
            floorCell.style.backgroundColor = '#f1f5f9';
            floorCell.style.fontWeight = '700';
            floorCell.style.paddingLeft = '1rem';

            let label = `${floorNum}階`;
            if (floorNum === 3) label = '業務員';
            floorCell.textContent = label;

            floorHeader.appendChild(floorCell);
            tbody.appendChild(floorHeader);

            filtered.forEach(staff => {
                const tr = document.createElement('tr');
                const nameTd = document.createElement('td');
                nameTd.textContent = staff.staff_id;
                tr.appendChild(nameTd);

                if (!window.globalFixedMask) window.globalFixedMask = {};
                if (!window.globalFixedMask[staff.staff_id]) {
                    window.globalFixedMask[staff.staff_id] = new Array(numDays).fill(false);
                }

                const dayCells = [];
                staff.shifts.forEach((shift, dIdx) => {
                    const td = document.createElement('td');
                    td.className = 'shift-cell';
                    const select = document.createElement('select');
                    select.className = 'shift-select val-' + shift;

                    if (window.globalFixedMask[staff.staff_id][dIdx] && shift !== '') {
                        select.classList.add('fixed-shift');
                        td.classList.add('fixed-cell');
                    }

                    SHIFTS.forEach(s => {
                        const opt = document.createElement('option');
                        opt.value = s;
                        opt.textContent = s === '' ? '未定' : s;
                        if (s === shift) opt.selected = true;
                        select.appendChild(opt);
                    });

                    select.addEventListener('change', () => {
                        const newVal = select.value;
                        staff.shifts[dIdx] = newVal;

                        // Manage manually fixed mask
                        if (newVal === '') {
                            window.globalFixedMask[staff.staff_id][dIdx] = false;
                            select.classList.remove('fixed-shift');
                            td.classList.remove('fixed-cell');
                        } else {
                            window.globalFixedMask[staff.staff_id][dIdx] = true;
                            select.classList.add('fixed-shift');
                            td.classList.add('fixed-cell');
                        }

                        // Update color class
                        select.classList.forEach(cls => {
                            if (cls.startsWith('val-')) select.classList.remove(cls);
                        });
                        select.classList.add('val-' + newVal);

                        updateStats();
                        updateDailyTotals();
                    });

                    // Toggle functionality
                    const toggleFixed = (e) => {
                        e.preventDefault(); // Prevent context menu if right-clicking
                        if (select.value === '') return; // 不要固定空セレクト

                        const isFixed = window.globalFixedMask[staff.staff_id][dIdx];
                        window.globalFixedMask[staff.staff_id][dIdx] = !isFixed;

                        if (!isFixed) {
                            select.classList.add('fixed-shift');
                            td.classList.add('fixed-cell');
                        } else {
                            select.classList.remove('fixed-shift');
                            td.classList.remove('fixed-cell');
                        }
                    };

                    select.addEventListener('dblclick', toggleFixed);
                    select.addEventListener('contextmenu', toggleFixed);

                    td.appendChild(select);
                    tr.appendChild(td);
                });

                // Summary and Stats Cells
                const statsCells = {};
                ['合計', '公休', '早②', '早③', '日', '遅①', '遅②'].forEach(key => {
                    const td = document.createElement('td');
                    td.style.fontWeight = 'bold';
                    tr.appendChild(td);
                    statsCells[key] = td;
                });

                const updateStats = () => {
                    let totalH = 0;
                    let totalKyu = 0;
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
                    statsCells['早②'].textContent = counts['早②'];
                    statsCells['早③'].textContent = counts['早③'];
                    statsCells['日'].textContent = counts['日'];
                    statsCells['遅①'].textContent = counts['遅①'];
                    statsCells['遅②'].textContent = counts['遅②'];
                };

                updateStats();
                tbody.appendChild(tr);
            });
        });
        scheduleTable.appendChild(tbody);

        // --- Daily Summary Footer ---
        const tfoot = document.createElement('tfoot');
        const dailySummaryCells = {}; // { shiftName: [td, td, ...] }

        SUMMARY_SHIFTS.forEach(shiftLabel => {
            const tr = document.createElement('tr');
            tr.className = 'summary-row';
            const labelTd = document.createElement('td');
            labelTd.textContent = shiftLabel + ' 合計';
            labelTd.style.fontWeight = 'bold';
            labelTd.style.backgroundColor = '#f8fafc';
            tr.appendChild(labelTd);

            dailySummaryCells[shiftLabel] = [];

            for (let d = 0; d < numDays; d++) {
                const td = document.createElement('td');
                td.className = 'summary-cell';
                tr.appendChild(td);
                dailySummaryCells[shiftLabel].push(td);
            }

            // Fill empty summary stats cols
            for (let i = 0; i < 7; i++) {
                const td = document.createElement('td');
                td.style.backgroundColor = '#f8fafc';
                tr.appendChild(td);
            }
            tfoot.appendChild(tr);
        });
        scheduleTable.appendChild(tfoot);

        const updateDailyTotals = () => {
            for (let d = 0; d < numDays; d++) {
                const counts = { '早②': 0, '早③': 0, '日': 0, '遅①': 0, '遅②': 0, '夜勤合計': 0 };
                scheduleData.forEach(staff => {
                    const s = staff.shifts[d];
                    if (counts[s] !== undefined) counts[s]++;
                    if (s === '夜①' || s === '夜②') counts['夜勤合計']++;
                });

                SUMMARY_SHIFTS.forEach(shiftLabel => {
                    const cell = dailySummaryCells[shiftLabel][d];
                    cell.textContent = counts[shiftLabel] || '0';
                    // Highlight if count > 0 for better visibility
                    if (counts[shiftLabel] > 0) {
                        cell.style.color = 'var(--primary)';
                        cell.style.fontWeight = '700';
                    } else {
                        cell.style.color = 'var(--text-muted)';
                        cell.style.fontWeight = '400';
                    }
                });
            }
        };

        // Initial Daily Totals
        updateDailyTotals();
    }

    // --- Init ---
    window.renderInternal = renderScheduleTable;
    window.loadSavedInternal = loadSavedSchedule;

    initializeStaff();
    loadSavedSchedule(); // Initial load for current month
    // Intentionally NOT loading saved schedule automatically, so we always start with a blank app.
    // The user has to click "Load Saved Data" to get it.
});
