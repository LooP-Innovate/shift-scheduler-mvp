import json
import datetime
import urllib.request
import base64

url = "http://localhost:8080/api/generate"

staff_list = []
current_shifts = []

for i in range(1, 31):
    floor = 1
    is_leader = False
    is_business = False
    
    if i == 1: floor = 1; is_leader = True
    elif i == 16: floor = 2; is_leader = True
    elif i in [29, 30]: floor = 3; is_business = True
    elif i < 16: floor = 1
    else: floor = 2
    
    staff_name = f"Staff {i}" + (" (責任者)" if is_leader else (" (業務員)" if is_business else ""))
    
    staff_list.append({
        "id": f"s{int(datetime.datetime.now().timestamp())}{i}",
        "name": staff_name,
        "can_night": False if (is_leader or is_business) else (i <= 28),
        "floor": floor,
        "restricted_shift": None,
        "is_weekday_only": (is_leader or is_business)
    })
    
    current_shifts.append({
        "staff_id": staff_name,
        "floor": floor,
        "shifts": [""] * 31
    })

# Add specials
staff_list.append({
    "id": "spec1",
    "name": "特定スタッフ A",
    "can_night": False,
    "floor": 1,
    "restricted_shift": "早③",
    "is_weekday_only": False
})
current_shifts.append({"staff_id": "特定スタッフ A", "floor": 1, "shifts": [""] * 31})

staff_list.append({
    "id": "spec2",
    "name": "特定スタッフ B",
    "can_night": False,
    "floor": 2,
    "restricted_shift": "早③",
    "is_weekday_only": False
})
current_shifts.append({"staff_id": "特定スタッフ B", "floor": 2, "shifts": [""] * 31})

payload = {
    "year": 2026,
    "month": 3,
    "staff_list": staff_list,
    "previous_shifts": {},
    "previous_holiday_counts": {},
    "current_shifts": current_shifts
}

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data)
req.add_header('Content-Type', 'application/json')
auth = base64.b64encode(b'admin:admin').decode('ascii')
req.add_header('Authorization', f'Basic {auth}')

try:
    with urllib.request.urlopen(req) as response:
        print(response.getcode())
        print("Success")
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode('utf-8'))
