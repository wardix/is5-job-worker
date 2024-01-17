import {
  fetchNisEmployeePhoneNumbers,
  updateNisEmployeePhoneNumber,
} from './database'
import {
  fetchNusaworkAuthToken,
  fetchNusaworkEmployeePhoneNumbers,
} from './api'

export async function synchronizeEmployeePhoneNumbers(): Promise<void> {
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

export async function executeJob(jobData: any): Promise<void> {
  console.log('Executing job:', jobData)
  if (jobData.name === 'syncEmployeeHP') {
    await synchronizeEmployeePhoneNumbers()
  }
}
