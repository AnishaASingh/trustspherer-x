from typing import Dict, List


def analyze_threat(
    department: str,
    risk_score: float
) -> Dict:

    departments = {
        "Finance": ["Accounts", "Management", "Procurement"],
        "HR": ["Employees", "Management", "Payroll"],
        "IT": ["Security", "Infrastructure", "Employees"],
        "Sales": ["Customers", "Finance", "Management"],
        "Operations": ["Finance", "IT", "Management"]
    }

    affected_departments: List[str] = []

    if department in departments:
        affected_departments = departments[department]

    if risk_score >= 80:
        propagation_level = "HIGH"
    elif risk_score >= 50:
        propagation_level = "MEDIUM"
    else:
        propagation_level = "LOW"

    return {
        "source_department": department,
        "affected_departments": affected_departments,
        "propagation_level": propagation_level,
        "risk_score": risk_score
    }