import openpyxl

try:
    wb = openpyxl.load_workbook('FIVE.xlsx', data_only=True)
    if 'statistiques' not in wb.sheetnames:
        print("Sheet 'statistiques' not found.")
        exit()

    sheet = wb['statistiques']
    
    # Get headers
    headers = [cell.value for cell in sheet[1]]
    print("Headers:", headers)

    # Get first 3 rows of data
    print("Row 2:", [cell.value for cell in sheet[2]])
    print("Row 3:", [cell.value for cell in sheet[3]])
    print("Row 4:", [cell.value for cell in sheet[4]])
    
except Exception as e:
    print(f"Error: {e}")
