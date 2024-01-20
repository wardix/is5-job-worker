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

async function synchronizeEmployeePhoneNumbers(): Promise<void> {
  const nisEmployeePhoneNumbers = await fetchNisEmployeePhoneNumbers()
  const authToken = await fetchNusaworkAuthToken()
  const nusaworkEmployeePhoneNumbers =
    await fetchNusaworkEmployeePhoneNumbers(authToken)

  for (const { employeeId, phoneNumber } of nisEmployeePhoneNumbers) {
    const nisPhoneNumber = phoneNumber
    const nusaworkPhoneNumber = nusaworkEmployeePhoneNumbers[employeeId]

    if (!nusaworkPhoneNumber || nisPhoneNumber === nusaworkPhoneNumber) continue

    console.log(`${employeeId}: ${nisPhoneNumber} -> ${nusaworkPhoneNumber}`)
    await updateNisEmployeePhoneNumber(employeeId, nusaworkPhoneNumber)
  }
}

async function deleteDeadGraphLinks(): Promise<void> {
  const nisGraphs = await fetchNisGraphs()
  const deadGraphs = await findDeadGraphs(nisGraphs)
  await deleteNisGraphs(deadGraphs)
}

export async function executeJob(jobData: any): Promise<void> {
  console.log('Executing job:', jobData)
  if (jobData.name === 'syncEmployeeHP') {
    await synchronizeEmployeePhoneNumbers()
    return
  }
  if (jobData.name === 'delDeadGraphLink') {
    await deleteDeadGraphLinks()
    return
  }
}
