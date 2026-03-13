from ortools.sat.python import cp_model

def solve_shift():
    num_days = 30
    num_staff = 5
    
    # Staff indices:
    # 0, 1, 2 can do night shifts. 3, 4 cannot.
    staff_can_night = [True, True, True, False, False]
    
    # Shift types:
    # 0: 休 (Off)
    # 1: 早番 (Morning)
    # 2: 日勤 (Day)
    # 3: 夜勤 (Night)
    num_shifts = 4
    
    # Required staff per shift per day (index exactly matches shift type)
    # Default requirement: 1 早番, 1 日勤, 1 夜勤. 休 is not required a specific number.
    daily_req = {
        1: 1, # 早番
        2: 1, # 日勤
        3: 1  # 夜勤
    }
    
    model = cp_model.CpModel()
    
    # x[e, d, s] = 1 if employee e works shift s on day d
    x = {}
    for e in range(num_staff):
        for d in range(num_days):
            for s in range(num_shifts):
                x[(e, d, s)] = model.NewBoolVar(f'shift_e{e}d{d}s{s}')
                
    # 制約1: 1日1シフトのみ割り当てる（休みもシフト0として扱う）
    for e in range(num_staff):
        for d in range(num_days):
            model.AddExactlyOne(x[(e, d, s)] for s in range(num_shifts))
            
    # 制約2: 各日の各シフトの必要人数を満たす
    for d in range(num_days):
        for s, req in daily_req.items():
            model.Add(sum(x[(e, d, s)] for e in range(num_staff)) == req)
            
    # 制約3: 夜勤（3）の翌日は絶対に休み（0）でなければならない
    for e in range(num_staff):
        for d in range(num_days - 1):
            # もし当日が夜勤なら、翌日は休みでなければならない
            # x[e, d, 3] == 1 => x[e, d+1, 0] == 1
            model.AddImplication(x[(e, d, 3)], x[(e, d+1, 0)])

    # 制約4: 夜勤に入れない職員には夜勤を割り当てない
    for e in range(num_staff):
        if not staff_can_night[e]:
            for d in range(num_days):
                model.Add(x[(e, d, 3)] == 0)

    # 制約5: 最大5連勤まで（6日間連続で勤務（シフト1, 2, 3）することは不可）
    # 「休み(0)」以外のシフトが6日間連続で入ることを禁止する
    for e in range(num_staff):
        for d in range(num_days - 5): # 6日間の窓（d, d+1, d+2, d+3, d+4, d+5）
            model.Add(
                sum(x[(e, d+k, s)] for k in range(6) for s in [1, 2, 3]) <= 5
            )

    # 目的関数（なるべくシフトの回数を均等にする、などのソフト制約は一旦MVPでは省略し、解を見つけることだけを優先）
    
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    status = solver.Solve(model)
    
    shift_names = ["休", "早番", "日勤", "夜勤"]
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        with open("schedule_output.md", "w", encoding="utf-8") as f:
            f.write("シフト生成成功！\n\n")
            header = "| 職員 |" + "|".join([f" {d+1:2d} |" for d in range(num_days)])
            f.write(header + "\n")
            f.write("|---|---" * num_days + "|\n")
            for e in range(num_staff):
                schedule = []
                for d in range(num_days):
                    for s in range(num_shifts):
                        if solver.Value(x[(e, d, s)]) == 1:
                            # 2文字表記にする
                            s_name = "休み" if s == 0 else shift_names[s]
                            schedule.append(s_name)
                
                # 各職員1文字表現で出力
                short_sch = []
                for s_name in schedule:
                    if s_name == "休み": short_sch.append("休")
                    elif s_name == "早番": short_sch.append("早")
                    elif s_name == "日勤": short_sch.append("日")
                    elif s_name == "夜勤": short_sch.append("夜")
                    
                row = f"| Staff{e+1} | " + " | ".join(short_sch) + " |"
                f.write(row + "\n")
    else:
        with open("schedule_output.md", "w", encoding="utf-8") as f:
            f.write("解が見つかりませんでした（制約が厳しすぎる可能性があります）。\n")

if __name__ == '__main__':
    solve_shift()
