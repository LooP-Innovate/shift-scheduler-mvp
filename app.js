let globalStaffList = [];

function forceResetV5() {
    console.log('--- GLOBAL RESET START ---');
    alert('リセット処理を開始します (Ver 5.0)');

    try {
        const year = parseInt(document.getElementById('year-select').value);
        const month = parseInt(document.getElementById('month-select').value);
        const numDays = new Date(year, month, 0).getDate();

        // Create empty schedule data from current globalStaffList
        const emptyData = globalStaffList.map(s => ({
            staff_id: s.name,
            floor: s.floor,
            shifts: new Array(numDays).fill('')
        }));

        // We need to call the internal render function. 
        // Since it's inside DOMContentLoaded, we might need to expose it or move it.
        // For now, let's try to just trigger it if available.
        if (window.renderInternal) {
            window.renderInternal(emptyData, numDays);
        } else {
            console.error('renderInternal not found on window');
            alert('内部描画関数が見つかりません');
        }

        document.getElementById('schedule-container').classList.remove('hidden');
        document.getElementById('save-btn').classList.remove('hidden');
        document.getElementById('export-btn').classList.remove('hidden');
        document.getElementById('error-message').classList.add('hidden');

        console.log('--- GLOBAL RESET END ---');
        alert('リセットが完了しました。表が「未定」になっているか確認してください。');
    } catch (err) {
        console.error('Global Reset Error:', err);
        alert('リセット中にエラーが発生しました: ' + err.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const generateBtn = document.getElementById('generate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const saveBtn = document.getElementById('save-btn');
    const exportBtn = document.getElementById('export-btn');
    const addStaffBtn = document.getElementById('add-staff-btn');
    const loadingState = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const scheduleContainer = document.getElementById('schedule-container');
    const scheduleTable = document.getElementById('schedule-table');

    const staffTbody = document.getElementById('staff-tbody');
    const staffTotalCountEl = document.getElementById('staff-total-count');
    const staffNightCountEl = document.getElementById('staff-night-count');
    const yearSelect = document.getElementById('year-select');
    const monthSelect = document.getElementById('month-select');

    // --- State ---
    let staffList = [];

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

    // Initialize with 32 staff total
    function initializeStaff() {
        staffList = [];
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
        globalStaffList = staffList;
        // 2 Special Otsubone-sama (Early 3 Only) - assign to floors
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
        globalStaffList = staffList; // Ensure global knows all staff
        renderStaffList();
    }

    // --- Render Staff ---
    function renderStaffList() {
        if (!staffTbody) return;
        staffTbody.innerHTML = '';

        staffList.forEach((staff, index) => {
            const tr = document.createElement('tr');

            // Name Input
            const tdName = document.createElement('td');
            const inputName = document.createElement('input');
            inputName.type = 'text';
            inputName.value = staff.name;
            inputName.className = 'staff-input';
            inputName.addEventListener('change', (e) => {
                staffList[index].name = e.target.value.trim();
            });
            tdName.appendChild(inputName);

            // Floor Selection
            const tdFloor = document.createElement('td');
            const selectFloor = document.createElement('select');
            selectFloor.className = 'staff-input';
            [1, 2].forEach(f => {
                const opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f + '階';
                if (staff.floor === f) opt.selected = true;
                selectFloor.appendChild(opt);
            });
            selectFloor.addEventListener('change', (e) => {
                staffList[index].floor = parseInt(e.target.value, 10);
            });
            tdFloor.appendChild(selectFloor);

            // Night Checkbox
            const tdNight = document.createElement('td');
            const inputNight = document.createElement('input');
            inputNight.type = 'checkbox';
            inputNight.checked = staff.can_night;
            inputNight.addEventListener('change', (e) => {
                staffList[index].can_night = e.target.checked;
                updateStaffCounts();
            });
            tdNight.appendChild(inputNight);

            // Restricted Shift Dropdown
            const tdRestricted = document.createElement('td');
            const selectRestricted = document.createElement('select');
            selectRestricted.className = 'staff-input';

            const SHIFT_OPTIONS = [
                { value: '', label: 'なし' },
                { value: '早②', label: '早②' },
                { value: '早③', label: '早③' },
                { value: '日', label: '日勤' },
                { value: '遅①', label: '遅①' },
                { value: '遅②', label: '遅②' }
            ];

            SHIFT_OPTIONS.forEach(optData => {
                const opt = document.createElement('option');
                opt.value = optData.value;
                opt.textContent = optData.label;
                if ((staff.restricted_shift || '') === optData.value) opt.selected = true;
                selectRestricted.appendChild(opt);
            });

            selectRestricted.addEventListener('change', (e) => {
                staffList[index].restricted_shift = e.target.value || null;
            });
            tdRestricted.appendChild(selectRestricted);

            // Weekday Only Checkbox
            const tdWeekday = document.createElement('td');
            const inputWeekday = document.createElement('input');
            inputWeekday.type = 'checkbox';
            inputWeekday.checked = staff.is_weekday_only;
            inputWeekday.addEventListener('change', (e) => {
                staffList[index].is_weekday_only = e.target.checked;
            });
            tdWeekday.appendChild(inputWeekday);

            // Actions
            const tdAction = document.createElement('td');
            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn-text';
            btnDelete.innerHTML = '削除';
            btnDelete.addEventListener('click', () => {
                staffList.splice(index, 1);
                renderStaffList();
            });
            tdAction.appendChild(btnDelete);

            tr.appendChild(tdName);
            tr.appendChild(tdFloor);
            tr.appendChild(tdNight);
            tr.appendChild(tdRestricted);
            tr.appendChild(tdWeekday);
            tr.appendChild(tdAction);
            staffTbody.appendChild(tr);
        });

        updateStaffCounts();
    }

    function updateStaffCounts() {
        const total = staffList.length;
        const night = staffList.filter(s => s.can_night).length;
        if (staffTotalCountEl) staffTotalCountEl.textContent = total;
        if (staffNightCountEl) staffNightCountEl.textContent = night;
    }

    // --- Add Staff ---
    addStaffBtn.addEventListener('click', () => {
        staffList.push({
            id: 's' + Date.now(),
            name: 'Staff ' + (staffList.length + 1),
            can_night: true,
            floor: 1,
            restricted_shift: null,
            is_weekday_only: false
        });
        renderStaffList();
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

            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `shift_schedule_${yearSelect.value}_${monthSelect.value}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
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
                renderScheduleTable(data.schedule, numDays);
                scheduleContainer.classList.remove('hidden');
                saveBtn.classList.remove('hidden');
                exportBtn.classList.remove('hidden');
            }
        } catch (e) {
            console.error('Failed to load schedule:', e);
        }
    }

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
            row.querySelectorAll('select').forEach(sel => shifts.push(sel.value));
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
        window.renderInternal = renderScheduleTable; // Expose to global scope
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

            // Sort: Weekday Only (Leaders/Business) at the top
            filtered.sort((a, b) => {
                const staffA = staffList.find(s => s.name === a.staff_id);
                const staffB = staffList.find(s => s.name === b.staff_id);
                if (staffA?.is_weekday_only && !staffB?.is_weekday_only) return -1;
                if (!staffA?.is_weekday_only && staffB?.is_weekday_only) return 1;
                return a.staff_id.localeCompare(b.staff_id, undefined, { numeric: true, sensitivity: 'base' });
            });

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

                const dayCells = [];
                staff.shifts.forEach((shift, dIdx) => {
                    const td = document.createElement('td');
                    td.className = 'shift-cell';
                    const select = document.createElement('select');
                    select.className = 'shift-select val-' + shift;
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

                        // Update color class
                        select.classList.forEach(cls => {
                            if (cls.startsWith('val-')) select.classList.remove(cls);
                        });
                        select.classList.add('val-' + newVal);

                        updateStats();
                        updateDailyTotals();
                    });

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
    initializeStaff();
    loadSavedSchedule();
});
