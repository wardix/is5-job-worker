import mysql, { Pool, RowDataPacket } from 'mysql2/promise'
import { dbzMysqlConfig, nisMysqlConfig, zabbixMysqlConfig } from './config'
import logger from './logger'
import { fetchNusaworkPresentEngineers, fetchVisitCards } from './api'

const nisMysqlPool: Pool = mysql.createPool(nisMysqlConfig)
const zabbixMysqlPool: Pool = mysql.createPool(zabbixMysqlConfig)
const dbzabbixMysqlPool: Pool = mysql.createPool(zabbixMysqlConfig)
const dbzMysqlPool: Pool = mysql.createPool(dbzMysqlConfig)

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

export async function getContactDetail(phone: string): Promise<any> {
  const contact: {
    name: string
    ids: string[]
    branches: string[]
    companies: any[]
    services: any[]
    accounts: any[]
    addresses: any[]
  } = {
    name: '',
    ids: [],
    branches: [],
    companies: [],
    services: [],
    accounts: [],
    addresses: [],
  }

  if (phone.length < 10) {
    return {}
  }

  const sql =
    'SELECT name, custId AS customerId FROM sms_phonebook' +
    ` WHERE phone LIKE '%${phone}'` +
    ' AND custId IS NOT NULL ORDER BY insertTime DESC'
  const [rows] = await nisMysqlPool.execute<RowDataPacket[]>(sql)
  rows.forEach(({ name, customerId }) => {
    if (contact.name === '') {
      contact.name = name
    }
    contact.ids.push(customerId)
  })

  if (contact.name === '') {
    return {}
  }
  if (contact.ids.length == 0) {
    return {}
  }

  const customerIdsSet = contact.ids.map((e) => `'${e}'`).join(',')
  const sql2 =
    'SELECT CustId AS customerId, CustCompany AS company,' +
    ' IFNULL(DisplayBranchId, BranchId) AS branch' +
    ` FROM Customer WHERE CustId IN (${customerIdsSet})`
  const [rows2] = await nisMysqlPool.execute<RowDataPacket[]>(sql2)
  rows2.forEach(({ customerId, company, branch }) => {
    const realCompany = company.trim()
    if (realCompany) {
      contact.companies.push({ id: customerId, name: realCompany })
    }
    if (contact.branches.includes(branch)) {
      return
    }
    contact.branches.push(branch)
  })

  const sql3 =
    'SELECT cs.CustServId AS subscriptionId, s.ServiceType AS service,' +
    ' cs.CustAccName AS account, IFNULL(cs.installation_address, "") AS address' +
    ' FROM CustomerServices cs' +
    ' LEFT JOIN Services s ON cs.ServiceId = s.ServiceId' +
    ' LEFT JOIN Customer c ON cs.CustId = c.CustId' +
    ` WHERE cs.CustId IN (${customerIdsSet}) AND cs.CustStatus != 'NA'`
  const [rows3] = await nisMysqlPool.execute<RowDataPacket[]>(sql3)
  rows3.forEach(({ subscriptionId, service, account, address }) => {
    const realAddress = address.trim().replace(/\s+/g, ' ')
    if (realAddress) {
      contact.addresses.push({ id: subscriptionId, name: realAddress })
    }
    contact.services.push({ id: subscriptionId, name: service })
    contact.accounts.push({ id: subscriptionId, name: account.trim() })
  })
  return contact
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

export async function fetchEngineers(): Promise<any> {
  const ignoredEngineers = [
    '0202403',
    '0200601',
    '0200615',
    '0200617',
    '0200912',
    '0201217',
    '0201308',
    '0201216',
  ]

  const sqlE = `
      SELECT EmpId employeeId, CONCAT(EmpFName, ' ', EmpLName) name, VisitCardUserId visitcardUserId
      FROM Employee
      WHERE NOT EmpJoinStatus = 'QUIT' AND DisplayBranchId = '020' AND DeptId = '04'
    `

  const engineerMap: any = {}

  const startTime = new Date()
  startTime.setHours(8, 30, 0, 0)

  const [rowsE] = await dbzMysqlPool.execute<RowDataPacket[]>(sqlE)
  rowsE.forEach(({ employeeId, name, visitcardUserId }) => {
    if (ignoredEngineers.includes(employeeId)) {
      return
    }
    engineerMap[employeeId] = { name, visitcardUserId, tickets: [] }
  })

  return engineerMap
}

export async function fetchTickets(startTime: Date): Promise<any> {
  const visitcardTicketMap: any = {}

  const sqlT = `
      SELECT tu.TtsId ticketId, t.AssignedNo picNo, t.VcId vcId, tu.UpdatedTime updatedTime, t.Status status, tu.Status updateStatus, t.VisitTime visitTime
      FROM TtsUpdate tu
      LEFT JOIN Tts t ON tu.TtsId = t.TtsId
      LEFT JOIN Employee e ON t.EmpId = e.EmpId
      WHERE t.Status IN ('Open', 'Pending', 'Call')
      AND t.VcId > 0 AND t.AssignedNo > 0 AND e.BranchId = '020'
      ORDER BY tu.TtsId, tu.UpdatedTime DESC
    `

  const ticketMap: any = {}
  const ignoredTickets: number[] = []
  const ticketIdPicNoPairs: number[][] = []
  const [rowsT] = await dbzMysqlPool.execute<RowDataPacket[]>(sqlT)
  rowsT.forEach(
    ({
      ticketId,
      picNo,
      vcId,
      updatedTime,
      status,
      updateStatus,
      visitTime,
    }) => {
      if (ticketId in ticketMap) {
        return
      }
      if (ignoredTickets.includes(ticketId)) {
        return
      }
      if (
        (status === 'Call' || status === 'Pending') &&
        updatedTime < startTime.getTime()
      ) {
        ignoredTickets.push(ticketId)
        return
      }
      let statusPriority = status === 'Open' ? 3 : 0
      if (visitTime) {
        const visitDate = new Date(visitTime)
        visitDate.setHours(0, 0, 0, 0)
        if (updateStatus !== 'Pending' && visitDate > startTime) {
          ignoredTickets.push(ticketId)
          return
        }
        statusPriority =
          updateStatus === 'Open' && status !== 'Call'
            ? 2
            : updateStatus === 'Pending' && updatedTime < startTime
              ? 2
              : 0
      }

      ticketMap[ticketId] = {
        vcId,
        updatedTime,
        status:
          status !== 'Call' && updatedTime > startTime ? updateStatus : status,
        visitTime,
        statusPriority,
      }
      visitcardTicketMap[vcId] = ticketId
      ticketIdPicNoPairs.push([ticketId, picNo])
    },
  )

  const ticketIdPicNoPairSets: string[] = []
  ticketIdPicNoPairs.forEach(([ticketId, picNo]) => {
    ticketIdPicNoPairSets.push(`(${ticketId}, ${picNo})`)
  })

  return { ticketMap, visitcardTicketMap, ticketIdPicNoPairSets }
}

export async function processTiketData(
  engineerMap: any,
  ticketIdPicNoPairSets: string[],
): Promise<any> {
  const sqlP = `
      SELECT tp.TtsId ticketId, tp.EmpId employeeId
      FROM TtsPIC tp
      LEFT JOIN Tts t ON tp.TtsId = t.TtsId
      WHERE (tp.TtsId, tp.AssignedNo) IN (${ticketIdPicNoPairSets.join(',')})
    `
  const [rowsP] = await dbzMysqlPool.execute<RowDataPacket[]>(sqlP)
  rowsP.forEach(({ ticketId, employeeId }) => {
    if (!(employeeId in engineerMap)) {
      return
    }
    engineerMap[employeeId].tickets.push(ticketId)
  })

  return engineerMap
}

export async function processEngineerTickets(): Promise<void> {
  const startTime = new Date()
  startTime.setHours(8, 30, 0, 0)

  let engineerMap = await fetchEngineers()
  const { ticketMap, visitcardTicketMap, ticketIdPicNoPairSets } =
    await fetchTickets(startTime)
  engineerMap = await processTiketData(engineerMap, ticketIdPicNoPairSets)

  const presentEngineers = await fetchNusaworkPresentEngineers(engineerMap)

  const visitcardCurrentUserTickets = await fetchVisitCards()

  const employeeNickname: any = {
    '0201324': 'Mansyur',
    '0201632': 'Heri',
    '0202127': 'Faiyad',
    '0202171': 'Hilmi',
    '0202426': 'Efen',
    '0202037': 'Ray',
    '0202105': 'Dani',
    '0202166': 'Riandino',
    '0202220': 'Alfi',
    '0202265': 'Hendy',
    '0202266': 'Putra',
    '0202370': 'Syafii',
    '0202344': 'Virza',
    '0201215': 'Irwansyah',
    '0201628': 'Rizki',
    '0201716': 'Rama',
    '0202255': 'Bagas',
    '0202257': 'Bobby',
    '0202305': 'Johan',
    '0202250': 'Christopher',
    '0202249': 'Wildan',
    '0202273': 'Febry',
    '0201505': 'Berto',
    '0201336': 'Solihin',
  }

  const orderedEngineers: any[] = []
  for (const employeeId of presentEngineers) {
    let idle = true
    let idleStartTime = startTime.getTime()
    const orderedTickets: any[] = []
    const ticketsOutput: string[] = []
    const [
      {
        last_update_time: visitcardLastUpdateTime,
        status_ticket_detail: visitcardTicketDetail,
        ca_id: visitcardTicketId,
      },
    ] = visitcardCurrentUserTickets.filter(
      ({ id }: any) => id == engineerMap[employeeId].visitcardUserId,
    )

    engineerMap[employeeId].tickets.forEach((ticketId: number) => {
      let statusPriority = 0
      if (
        visitcardTicketId in visitcardTicketMap &&
        visitcardTicketMap[visitcardTicketId] == ticketId &&
        +visitcardTicketDetail.time > startTime.getTime()
      ) {
        statusPriority = 1
        ticketMap[ticketId].status = visitcardTicketDetail.status
      } else {
        statusPriority = ticketMap[ticketId].statusPriority
      }
      let visitPriority = 0
      if (ticketMap[ticketId].visitTime) {
        const date = new Date(ticketMap[ticketId].visitTime)
        visitPriority = date.getTime()
      } else {
        const date = new Date(ticketMap[ticketId].updatedTime)
        visitPriority = date.getTime() + 86400000
      }
      orderedTickets.push({
        ticketId,
        statusPriority,
        visitPriority,
      })
    })

    orderedTickets.sort((a, b) => {
      if (a.statusPriority == b.statusPriority) {
        return a.visitPriority - b.visitPriority
      }
      return a.statusPriority - b.statusPriority
    })

    const visitcardLastUpdate =
      visitcardTicketDetail.status == 'idle'
        ? +visitcardLastUpdateTime
        : +visitcardTicketDetail.time
    const actionStartTime = new Date(
      visitcardLastUpdate > startTime.getTime()
        ? visitcardLastUpdate
        : startTime.getTime(),
    )

    const hours = actionStartTime.getHours().toString().padStart(2, '0')
    const minutes = actionStartTime.getMinutes().toString().padStart(2, '0')
    const formatedActionStartTime = `${hours}:${minutes}`

    orderedTickets.forEach(({ ticketId }) => {
      let prefix = ''
      let suffix = ''
      if (ticketMap[ticketId].status === 'Call') {
        prefix = '☑'
      } else if (ticketMap[ticketId].status === 'Pending') {
        prefix = `⏸`
      } else if (ticketMap[ticketId].status === 'done') {
        prefix = `[*${formatedActionStartTime}*]☑`
        idleStartTime = actionStartTime.getTime()
      } else if (ticketMap[ticketId].status === 'working') {
        prefix = `[${formatedActionStartTime}]▶`
        idle = false
      } else if (ticketMap[ticketId].status === 'pending') {
        prefix = `[*${formatedActionStartTime}*]⏸`
        idleStartTime = actionStartTime.getTime()
      } else if (ticketMap[ticketId].status === 'ontheway') {
        prefix = `[${formatedActionStartTime}]🛫`
        idle = false
      } else {
        prefix = '☐'
      }
      if (
        ticketMap[ticketId].visitTime &&
        ticketMap[ticketId].status !== 'Call' &&
        ticketMap[ticketId].visitTime > startTime
      ) {
        const date = new Date(ticketMap[ticketId].visitTime)
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        suffix = `[${hours}:${minutes}]`
      }
      ticketsOutput.push(`${prefix}${ticketId}${suffix}`)
    })

    orderedEngineers.push({
      employeeId,
      idle,
      idleStartTime,
      tickets: ticketsOutput,
    })
  }
  orderedEngineers.sort((a, b) => {
    if (a.idle === b.idle) {
      if (a.idleStartTime === b.idleStartTime) {
        return a.tickets.length - b.tickets.length
      }
      return a.idleStartTime - b.idleStartTime
    }
    return b.idle - a.idle
  })
  for (const { employeeId, idle, tickets } of orderedEngineers) {
    const name =
      employeeId in employeeNickname
        ? employeeNickname[employeeId]
        : `${employeeId} ${engineerMap[employeeId].name}`
    if (idle) {
      if (tickets.length > 0) {
        console.log(`*${name}* - ${tickets.join(', ')}`)
      } else {
        console.log(`*${name}*`)
      }
    } else {
      console.log(`${name} - ${tickets.join(', ')}`)
    }
  }
}
