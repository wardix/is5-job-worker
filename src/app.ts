import {
  fetchNisEmployeePhoneNumbers,
  updateNisEmployeePhoneNumber,
  deleteNisGraphs,
  fetchNisGraphs,
  findDeadGraphs,
} from './database'
import {
  fetchNusaworkAuthToken,
  fetchNusaworkEmployeePhoneNumbers,
} from './api'
import logger from './logger'

async function synchronizeEmployeePhoneNumbers(): Promise<void> {
  const nisEmployeePhoneNumbers = await fetchNisEmployeePhoneNumbers()
  const authToken = await fetchNusaworkAuthToken()
  const nusaworkEmployeePhoneNumbers =
    await fetchNusaworkEmployeePhoneNumbers(authToken)

  for (const { employeeId, phoneNumber } of nisEmployeePhoneNumbers) {
    const nisPhoneNumber = phoneNumber
    const nusaworkPhoneNumber = nusaworkEmployeePhoneNumbers[employeeId]

    if (!nusaworkPhoneNumber || nisPhoneNumber === nusaworkPhoneNumber) continue

    logger.info(`${employeeId}: ${nisPhoneNumber} -> ${nusaworkPhoneNumber}`)
    await updateNisEmployeePhoneNumber(employeeId, nusaworkPhoneNumber)
  }
}

async function deleteDeadGraphLinks(): Promise<void> {
  const nisGraphs = await fetchNisGraphs()
  const deadGraphs = await findDeadGraphs(nisGraphs)
  if (deadGraphs.length == 0) {
    return
  }
  await deleteNisGraphs(deadGraphs)
}

export async function executeJob(jobData: any): Promise<void> {
  logger.info(`Execute job: ${JSON.stringify(jobData)}`)
  if (jobData.name === 'syncEmployeeHP') {
    await synchronizeEmployeePhoneNumbers()
    return
  }
  if (jobData.name === 'delDeadGraphLink') {
    await deleteDeadGraphLinks()
    return
  }
}
