import mysql, { Pool, RowDataPacket } from 'mysql2/promise'
import { nisMysqlConfig, zabbixMysqlConfig } from './config'

const nisMysqlPool: Pool = mysql.createPool(nisMysqlConfig)
const zabbixMysqlPool: Pool = mysql.createPool(zabbixMysqlConfig)

export interface EmployeePhoneNumber {
  employeeId: string
  phoneNumber: string
}

export async function fetchNisEmployeePhoneNumbers(): Promise<
  EmployeePhoneNumber[]
> {
  const sql =
    'SELECT EmpId AS employeeId, EmpHP AS phoneNumber FROM Employee WHERE BranchId = ? AND NOT (EmpJoinStatus = ?)'
  const [rows] = await nisMysqlPool.execute<RowDataPacket[]>(sql, [
    '020',
    'QUIT',
  ])
  return rows as EmployeePhoneNumber[]
}

export async function updateNisEmployeePhoneNumber(
  employeeId: string,
  phoneNumber: string,
): Promise<void> {
  const sql = 'UPDATE Employee SET EmpHP = ? WHERE EmpId = ?'
  try {
    await nisMysqlPool.execute(sql, [phoneNumber, employeeId])
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

export async function fetchNisGraphs(): Promise<number[]> {
  const sql =
    'SELECT cszg.GraphId AS graphId FROM CustomerServicesZabbixGraph cszg' +
    ' LEFT JOIN CustomerServices cs ON cszg.CustServId = cs.CustServId' +
    ' LEFT JOIN Customer c ON cs.CustId = c.CustId' +
    " WHERE NOT (cs.CustStatus = 'NA')" +
    " AND c.BranchId = '020'"

  const [rows] = await nisMysqlPool.execute<RowDataPacket[]>(sql)
  return rows.map((e) => +e.graphId)
}

export async function findDeadGraphs(graphIds: number[]): Promise<number[]> {
  const graphIdsSet = graphIds.map((e) => `${e}`).join(',')

  const sql = `SELECT graphid AS graphId FROM graphs WHERE graphid IN (${graphIdsSet})`
  const [rows] = await zabbixMysqlPool.execute<RowDataPacket[]>(sql)
  const validGraphIds = rows.map((e) => e.graphId)
  const returnData = []
  for (const graphId of graphIds) {
    if (validGraphIds.includes(graphId)) {
      continue
    }
    returnData.push(graphId)
  }

  return returnData
}

export async function deleteNisGraphs(graphIds: number[]): Promise<void> {
  const graphIdsSet = graphIds.map((e) => `'${e}'`).join(',')
  const sql = `DELETE FROM CustomerServicesZabbixGraph WHERE GraphId IN (${graphIdsSet})`
  try {
    await nisMysqlPool.execute(sql)
    console.log('Dead graphs deleted successfully')
  } catch (error) {
    console.error(`Error deleting dead graphs`, error)
  }
}
