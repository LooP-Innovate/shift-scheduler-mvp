from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from ortools.sat.python import cp_model
from typing import List, Optional, Dict
import pandas as pd
import io
from fastapi.responses import Response, HTMLResponse, FileResponse
import uuid
import datetime
import calendar
import json
import os
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi import Depends
from starlette.status import HTTP_401_UNAUTHORIZED
from openpyxl.utils import get_column_letter
from openpyxl.styles import Font, Border, Side, Alignment, PatternFill

app = FastAPI()
security = HTTPBasic()

def authenticate(credentials: HTTPBasicCredentials = Depends(security)):
    correct_password = os.getenv("AUTH_PASSWORD", "admin") # Default to admin if not set
    if credentials.username != "admin" or credentials.password != correct_password:
        raise HTTPException(
            status_code=HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# Ensure storage directories exist
os.makedirs("schedules", exist_ok=True)
os.makedirs("static", exist_ok=True)

# Cleanup old temp export files on startup
try:
    for f in os.listdir("schedules"):
        if f.startswith("export_") and f.endswith(".xlsx"):
            os.remove(os.path.join("schedules", f))
    print("Cleaned up temporary export files.")
except Exception as e:
    print(f"Cleanup error: {e}")

# ---- Pydantic Models ----
class Staff(BaseModel):
    id: str
    name: str
    can_night: bool
    floor: int  # 1 or 2
    restricted_shift: Optional[str] = None # e.g. "早③"
    is_weekday_only: bool = False

class ScheduleRequest(BaseModel):
    year: int = datetime.datetime.now().year
    month: int = datetime.datetime.now().month
    staff_list: List[Staff]
    # Previous month's last 3 shifts for each staff (name -> [shift1, shift2, shift3])
    previous_shifts: Dict[str, List[str]] = {}
    previous_holiday_counts: Dict[str, float] = {}
    # Current table state to fix specific cells (name -> [shift1, shift2, ... or null])
    current_shifts: Optional[List[dict]] = None

# ---- Scheduling Logic ----
def generate_schedule(year: int, month: int, staff_list: List[Staff], prev_shifts_map: Dict[str, List[str]], prev_holiday_counts: Dict[str, float], fixed_shifts_data: Optional[List[dict]] = None):
    _, num_days = calendar.monthrange(year, month)
    num_staff = len(staff_list)
    
    # Shift types: 
    # 0: 休, 1: 早②, 2: 早③, 3: 日, 4: 遅①, 5: 遅②, 6: 夜①, 7: 夜②, 8: 明け, 9: 病休, 10: 欠勤
    num_shifts = 11
    shift_names = ["休", "早②", "早③", "日", "遅①", "遅②", "夜①", "夜②", "明け", "病休", "欠勤"]
    
    model = cp_model.CpModel()
    x = {}
    for e in range(num_staff):
        for d in range(num_days):
            for s in range(num_shifts):
                x[(e, d, s)] = model.NewBoolVar(f'shift_e{e}d{d}s{s}')
                
    # 1. Exactly one shift per day
    for e in range(num_staff):
        for d in range(num_days):
            model.AddExactlyOne(x[(e, d, s)] for s in range(num_shifts))
            
    # 2. Daily requirement (Exactly 1 per functional shift per floor)
    floor1_staff = [e for e, s in enumerate(staff_list) if s.floor == 1]
    floor2_staff = [e for e, s in enumerate(staff_list) if s.floor == 2]

    s3_vars = []
    for d in range(num_days):
        # Mandatory shifts: 早②, 早③, 遅①, 遅②, 夜①, 夜② (Exactly 1 per floor)
        for s in [1, 2, 4, 5, 6, 7]:
            if floor1_staff:
                model.Add(sum(x[(e, d, s)] for e in floor1_staff) == 1)
            if floor2_staff:
                model.Add(sum(x[(e, d, s)] for e in floor2_staff) == 1)
        
        # Flexible Shift 3 (日勤) - Maximize this to fill up staff hours
        for e in range(num_staff):
            s3_vars.append(x[(e, d, 3)])
    
    # Priority:
    # 1. Get as many people to 10 days (20 points) as possible.
    # 2. Maximize additional Day Shifts (日勤).
    off_point_vars = []
    for e in range(num_staff):
        op = model.NewIntVar(0, 60, f'off_points_e{e}')
        # Holiday (0), Ake (8), Sick (9), Absent (10) contribute to off points
        # Sick and Absent count as full off days (2 points, same as '休')
        model.Add(op == sum(x[(e, d, 0)] * 2 for d in range(num_days)) + 
                         sum(x[(e, d, 8)] * 1 for d in range(num_days)) +
                         sum(x[(e, d, 9)] * 2 for d in range(num_days)) +
                         sum(x[(e, d, 10)] * 2 for d in range(num_days)))
        off_point_vars.append(op)

    is_target_holiday = []
    for e in range(num_staff):
        target_met = model.NewBoolVar(f'target_met_e{e}')
        # We define "Target Met" as having at least 20 points (10 days)
        model.Add(off_point_vars[e] >= 20).OnlyEnforceIf(target_met)
        is_target_holiday.append(target_met)

    model.Maximize(sum(is_target_holiday) * 1000 + sum(s3_vars))
            
    # 3. Night -> 明け -> 休 (Strict 3-day pattern)
    for e in range(num_staff):
        for d in range(num_days - 2):
            model.AddImplication(x[(e, d, 6)], x[(e, d+1, 8)])
            model.AddImplication(x[(e, d, 7)], x[(e, d+1, 8)])
            model.AddImplication(x[(e, d+1, 8)], x[(e, d+2, 0)])
        if num_days >= 2:
            model.AddImplication(x[(e, num_days-2, 6)], x[(e, num_days-1, 8)])
            model.AddImplication(x[(e, num_days-2, 7)], x[(e, num_days-1, 8)])

        # 3.1 Month Boundary Continuity
        staff = staff_list[e]
        staff_name = staff.name.strip()
        if staff_name in prev_shifts_map:
            p_shifts = prev_shifts_map[staff_name]
            if p_shifts:
                last_shift = p_shifts[-1]
                if last_shift in ["夜①", "夜②"]:
                    model.Add(x[(e, 0, 8)] == 1)
                    if num_days >= 2: model.Add(x[(e, 1, 0)] == 1)
                if last_shift == "明け":
                    model.Add(x[(e, 0, 0)] == 1)
                if len(p_shifts) >= 2:
                    scnd_last = p_shifts[-2]
                    if scnd_last in ["夜①", "夜②"] and last_shift == "明け":
                        model.Add(x[(e, 0, 0)] == 1)

    # 4. Night Availability & Restricted Shifts
    for e, staff in enumerate(staff_list):
        if not staff.can_night:
            for d in range(num_days):
                model.Add(x[(e, d, 6)] == 0)
                model.Add(x[(e, d, 7)] == 0)

        if staff.restricted_shift and staff.restricted_shift in shift_names:
            s_idx = shift_names.index(staff.restricted_shift)
            for d in range(num_days):
                model.Add(sum(x[(e, d, s)] for s in range(num_shifts) if s not in [0, s_idx]) == 0)
        
        # 4.2 Weekday Only Handling (Mon-Fri = Day Shift (3), Sat-Sun = Off (0))
        if staff.is_weekday_only:
            for d in range(num_days):
                dt = datetime.date(year, month, d + 1)
                if dt.weekday() >= 5: # Sat=5, Sun=6
                    model.Add(x[(e, d, 0)] == 1)
                else:
                    model.Add(x[(e, d, 3)] == 1)

    # 4.3 Default: Prohibit AI from picking Sick/Absent (indices 9, 10) for unassigned slots
    # This ensures they only appear if manually fixed by user
    fixed_indices = {} # (e, d) -> shift_index
    if fixed_shifts_data:
        fixed_map = {item['staff_id']: item['shifts'] for item in fixed_shifts_data}
        for e, staff in enumerate(staff_list):
            if staff.name in fixed_map:
                f_shifts = fixed_map[staff.name]
                for d in range(min(num_days, len(f_shifts))):
                    fs = f_shifts[d]
                    if fs and fs in shift_names:
                        s_idx = shift_names.index(fs)
                        fixed_indices[(e, d)] = s_idx

    for e in range(num_staff):
        for d in range(num_days):
            # If (e, d) is not manually fixed to 9 or 10, prohibit the AI from choosing them
            if fixed_indices.get((e, d)) == 9:
                model.Add(x[(e, d, 9)] == 1)
            else:
                model.Add(x[(e, d, 9)] == 0)
                
            if fixed_indices.get((e, d)) == 10:
                model.Add(x[(e, d, 10)] == 1)
            else:
                model.Add(x[(e, d, 10)] == 0)

            # Apply other manual fixes (0-8)
            s_idx = fixed_indices.get((e, d))
            if s_idx is not None and s_idx < 9:
                model.Add(x[(e, d, s_idx)] == 1)

    # 5. Continuous work limit & Initial Streak
    for e in range(num_staff):
        staff = staff_list[e]
        initial_streak = 0
        if staff.name.strip() in prev_shifts_map:
            for s in reversed(prev_shifts_map[staff.name.strip()]):
                if s in shift_names[1:8]: initial_streak += 1
                else: break
        
        for d in range(num_days - 5): 
            model.Add(sum(x[(e, d+k, s)] for k in range(6) for s in range(1, 8)) <= 5)
        
        if initial_streak > 0:
            for k in range(1, 6):
                if initial_streak + k > 5:
                    model.Add(sum(x[(e, d_idx, s)] for d_idx in range(k) for s in [0, 8]) >= 1)

    # 6. Off days (8-12 days per person)
    for e in range(num_staff):
        staff = staff_list[e]
        op = off_point_vars[e]
        
        # Tightened range: 9 to 11 days (18 to 22 points)
        # 12 days (24 points) is now disallowed.
        model.Add(op >= 18) 
        model.Add(op <= 22)

        # Rule: If previous month < 10 days, current month MUST BE >= 10 days (20 points)
        # We skip this for weekday-only staff (leaders/business) as their schedule is fixed
        if not staff.is_weekday_only:
            prev_count = prev_holiday_counts.get(staff.name.strip(), 10.0) # Default to 10 if unknown
            if prev_count < 10.0:
                model.Add(op >= 20)
            
    # 7. Night Shift Limit (Relaxed to 8)
    for e in range(num_staff):
        model.Add(sum(x[(e, d, 6)] + x[(e, d, 7)] for d in range(num_days)) <= 8)

    # 8. 36 Agreement (Work Hour Limit: Max 176h)
    for e in range(num_staff):
        total_hours = sum(x[(e, d, s)] * 8 for d in range(num_days) for s in range(1, 6)) + \
                      sum(x[(e, d, s)] * 12 for d in range(num_days) for s in range(6, 8))
        model.Add(total_hours <= 176)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    
    # Enable robust randomization for varied results
    import random
    seed_val = random.randint(1, 1000000)
    solver.parameters.random_seed = seed_val
    
    # Add a decision strategy to pick random values for the variables.
    # This ensures different feasible/optimal solutions each time.
    all_vars = [x[(e, d, s)] for e in range(num_staff) for d in range(num_days) for s in range(num_shifts)]
    model.AddDecisionStrategy(all_vars, cp_model.CHOOSE_FIRST, cp_model.SELECT_RANDOM_VALUE)
    
    # Single worker with decision strategy gives high variety for small problems.
    solver.parameters.num_search_workers = 1
    
    

    status = solver.Solve(model)
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        schedule_data = []
        for e, staff in enumerate(staff_list):
            staff_schedule = []
            for d in range(num_days):
                for s in range(num_shifts):
                    if solver.Value(x[(e, d, s)]) == 1:
                        staff_schedule.append(shift_names[s])
            schedule_data.append({"staff_id": staff.name, "floor": staff.floor, "shifts": staff_schedule})
        return {"status": "success", "schedule": schedule_data, "num_days": num_days}
    else:
        return {"status": "failed", "message": "条件が厳しすぎます。夜勤人数や労働制限を調整してください。"}

# ---- API Endpoints ----
@app.post("/api/generate")
def api_generate_schedule(req: ScheduleRequest, username: str = Depends(authenticate)):
    result = generate_schedule(req.year, req.month, req.staff_list, req.previous_shifts, req.previous_holiday_counts, req.current_shifts)
    if result["status"] == "failed":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

class ExportRequest(BaseModel):
    schedule: List[dict]
    year: int
    month: int
    num_days: int = 30

@app.post("/api/export")
def api_export_schedule(req: ExportRequest, username: str = Depends(authenticate)):
    try:
        import openpyxl
        from openpyxl.styles import Font, Border, Side, Alignment, PatternFill
        from openpyxl.utils import get_column_letter
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Sheet1"
        
        num_cols = req.num_days + 9
        
        # --- Title Row ---
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=num_cols)
        title_cell = ws.cell(row=1, column=1)
        title_cell.value = f"【{req.year}年 {req.month}月】 勤務予定表"
        title_cell.font = Font(name='Meiryo UI', size=16, bold=True)
        title_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 40
        
        # --- Header Row ---
        weekdays_ja = ['日', '月', '火', '水', '木', '金', '土']
        headers = ["スタッフ", "階"]
        for d in range(req.num_days):
            dt = datetime.date(req.year, req.month, d + 1)
            wd = weekdays_ja[dt.weekday()]
            headers.append(f"{d+1}({wd})")
        headers.extend(["合計", "公休", "早②", "早③", "日", "遅①", "遅②"])
        
        header_font = Font(name='Meiryo UI', size=10, bold=True)
        header_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
        align_center = Alignment(horizontal="center", vertical="center")
        
        for col_idx, h_text in enumerate(headers, 1):
            cell = ws.cell(row=2, column=col_idx)
            cell.value = h_text
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = align_center
            
            # Weekend Highlighting
            if 2 < col_idx <= req.num_days + 2:
                d_num = col_idx - 2
                dt = datetime.date(req.year, req.month, d_num)
                if dt.weekday() == 5: # Sat
                    cell.fill = PatternFill(start_color="EBF5FF", end_color="EBF5FF", fill_type="solid")
                elif dt.weekday() == 6: # Sun
                    cell.fill = PatternFill(start_color="FEF2F2", end_color="FEF2F2", fill_type="solid")

        # --- Data Rows ---
        thin = Side(border_style="thin", color="000000")
        border = Border(top=thin, left=thin, right=thin, bottom=thin)
        standard_font = Font(name='Meiryo UI', size=10)
        
        # Sort schedule: floor 1, floor 2, floor 3
        sorted_schedule = sorted(req.schedule, key=lambda x: (x['floor'], x['staff_id']))
        
        current_row = 3
        for s in sorted_schedule:
            # Calculate metrics
            total_h = 0
            total_kyu = 0
            counts = {"早②": 0, "早③": 0, "日": 0, "遅①": 0, "遅②": 0}
            for shift in s["shifts"]:
                if shift in ["早②", "早③", "日", "遅①", "遅②"]: total_h += 8
                elif shift in ["夜①", "夜②"]: total_h += 12
                if shift == "休": total_kyu += 1.0
                elif shift == "明け": total_kyu += 0.5
                if shift in counts: counts[shift] += 1
            
            floor_label = f"{s['floor']}階"
            if s['floor'] == 3: floor_label = "業務員"
            
            row_data = [s['staff_id'], floor_label] + s['shifts'] + \
                       [f"{total_h}h", f"{total_kyu}日", counts["早②"], counts["早③"], counts["日"], counts["遅①"], counts["遅②"]]
            
            for col_idx, val in enumerate(row_data, 1):
                cell = ws.cell(row=current_row, column=col_idx)
                cell.value = val
                cell.font = standard_font
                cell.border = border
                if col_idx > 1: cell.alignment = align_center
            
            ws.row_dimensions[current_row].height = 20
            current_row += 1

        # --- Column Widths ---
        ws.column_dimensions['A'].width = 18
        ws.column_dimensions['B'].width = 8
        for d in range(req.num_days):
            ws.column_dimensions[get_column_letter(d + 3)].width = 7.0
        
        stat_start = req.num_days + 3
        ws.column_dimensions[get_column_letter(stat_start)].width = 10
        ws.column_dimensions[get_column_letter(stat_start+1)].width = 8
        for i in range(5):
            ws.column_dimensions[get_column_letter(stat_start + 2 + i)].width = 6.0

        # --- Print Setup ---
        ws.page_setup.orientation = 'landscape'
        ws.page_setup.paperSize = 8 # A3
        ws.page_setup.fitToPage = True
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 1
        ws.print_options.horizontalCentered = True

        output = io.BytesIO()
        wb.save(output)
        content = output.getvalue()
        
        file_id = str(uuid.uuid4())
        debug_fn = f"schedules/export_{file_id}.xlsx"
        with open(debug_fn, "wb") as f:
            f.write(content)
        
        return {"file_id": file_id}
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download/{file_id}")
def api_download_file(file_id: str, username: str = Depends(authenticate)):
    filename = f"schedules/export_{file_id}.xlsx"
    if not os.path.exists(filename):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Generate a nice-looking filename for the user
    now = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    display_name = f"shift_schedule_{now}.xlsx"
    
    return FileResponse(
        path=filename,
        filename=display_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

class SaveRequest(BaseModel):
    year: int
    month: int
    schedule: List[dict]

@app.post("/api/save")
def api_save_schedule(req: SaveRequest, username: str = Depends(authenticate)):
    try:
        filename = f"schedules/{req.year}_{req.month}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(req.schedule, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "保存しました。"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/load")
def api_load_schedule(year: int, month: int, username: str = Depends(authenticate)):
    filename = f"schedules/{year}_{month}.json"
    if not os.path.exists(filename): return {"status": "not_found", "schedule": None}
    try:
        with open(filename, "r", encoding="utf-8") as f: schedule = json.load(f)
        return {"status": "success", "schedule": schedule}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root(username: str = Depends(authenticate)):
    html_path = os.path.join("static", "index_v6.html")
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()
    headers = {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    return HTMLResponse(content=content, headers=headers)

app.mount("/", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
