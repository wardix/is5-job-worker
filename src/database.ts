import mysql, { Pool, RowDataPacket } from 'mysql2/promise'
import { mysqlConfig } from './config'

const mysqlPool: Pool = mysql.createPool(mysqlConfig)

export interface EmployeePhoneNumber {
  employeeId: string
  phoneNumber: string
}

export async function fetchNisEmployeePhoneNumbers(): Promise<
  EmployeePhoneNumber[]
> {
  const sql =
    'SELECT EmpId AS employeeId, EmpHP AS phoneNumber FROM Employee WHERE BranchId = ? AND NOT (EmpJoinStatus = ?)'
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(sql, ['020', 'QUIT'])
  return rows as EmployeePhoneNumber[]
}

export async function updateNisEmployeePhoneNumber(
  employeeId: string,
  phoneNumber: string,
): Promise<void> {
  const sql = 'UPDATE Employee SET EmpHP = ? WHERE EmpId = ?'
  try {
    await mysqlPool.execute(sql, [phoneNumber, employeeId])
    console.log(
      `Employee phone number updated successfully for employeeId: ${employeeId}`,
    )
  } catch (error) {
    console.error(
      `Error updating phone number for employeeId: ${employeeId}`,
      error,
    )
  }
}
