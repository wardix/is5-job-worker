import mysql, { Pool, RowDataPacket } from 'mysql2/promise'
import { nisMysqlConfig, zabbixMysqlConfig } from './config'
import logger from './logger'

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
    logger.info(
      `Employee phone number updated successfully for employeeId: ${employeeId}`,
    )
  } catch (error) {
    const errorMessage = (error as Error).message
    logger.error(
      `Error updating phone number for employeeId: ${employeeId} ${errorMessage}`,
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

export async function fetchBlockedSubscriberGraphs(): Promise<any> {
  const sql =
    'SELECT cs.CustAccName AS acc, cs.CustServId AS csid,' +
    ' cszg.GraphId AS graphId' +
    ' FROM CustomerServicesZabbixGraph cszg' +
    ' LEFT JOIN CustomerServices cs ON cszg.CustServId = cs.CustServId' +
    ' LEFT JOIN Customer c ON c.CustId = cs.CustId' +
    " WHERE cs.CustStatus = 'BL' AND c.BranchId = '020'" +
    ' ORDER BY cs.CustServId, cszg.Id'

  const [rows] = await nisMysqlPool.execute<RowDataPacket[]>(sql)
  const subscribersGraphMap: any = {}
  rows.forEach((e) => {
    const { acc, csid, graphId } = e
    if (!(graphId in subscribersGraphMap)) {
      subscribersGraphMap[graphId] = []
    }
    subscribersGraphMap[graphId].push({ csid, acc })
  })

  return subscribersGraphMap
}

export async function findOverSpeedGraphs(
  graphIds: number[],
  speedThreshold: number,
): Promise<number[]> {
  const graphIdsSet = graphIds.map((e) => `${e}`).join(',')
  let sql =
    'SELECT graphid AS graphId, itemid AS itemId FROM graphs_items' +
    ` WHERE graphid IN (${graphIdsSet})`
  const [rows] = await zabbixMysqlPool.execute<RowDataPacket[]>(sql)
  const graphsItemMap = new Map<number, number[]>()
  const itemIds = new Set<number>()
  rows.forEach((e) => {
    const { graphId, itemId } = e
    if (!itemIds.has(itemId)) {
      itemIds.add(itemId)
    }
    if (!graphsItemMap.has(itemId)) {
      graphsItemMap.set(itemId, [])
    }

    const tmpGraphIds = graphsItemMap.get(itemId) as number[]
    tmpGraphIds.push(graphId)
    graphsItemMap.set(itemId, tmpGraphIds)
  })

  const itemIdsSet = Array.from(itemIds)
    .map((e) => `${e}`)
    .join(',')
  const now = Math.floor(Date.now() / 1000)
  const startPeriod = now - 14400
  sql =
    'SELECT DISTINCT(itemid) AS itemId FROM history_uint' +
    ` WHERE clock > ${startPeriod} AND value > ${speedThreshold}` +
    ` AND itemid IN (${itemIdsSet})`
  const [itemRows] = await zabbixMysqlPool.execute<RowDataPacket[]>(sql)
  const overSpeedGraphs = new Set<number>()
  itemRows.forEach(({ itemId }) => {
    const graphs = graphsItemMap.get(itemId) as number[]
    for (const graphId of graphs) {
      if (overSpeedGraphs.has(graphId)) {
        continue
      }
      overSpeedGraphs.add(graphId)
    }
  })

  return Array.from(overSpeedGraphs)
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
    logger.info('Dead graphs deleted successfully')
  } catch (error) {
    const errorMessage = (error as Error).message
    logger.error(`Error deleting dead graphs ${errorMessage}`)
  }
}
