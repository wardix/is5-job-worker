import axios from 'axios'
import {
  nusaworkAuthTokenApiUrl,
  nusaworkAuthTokenApiKey,
  nusaworkEmployeeApiUrl,
  nusacontactSyncContactApiUrl,
  nusacontactApiKey,
  nusacontactSyncContactMaxAttempts,
} from './config'
import { formatPhoneNumber } from './utils'

export async function fetchNusaworkAuthToken(): Promise<string> {
  const response = await axios.get<{ token: string }>(nusaworkAuthTokenApiUrl, {
    headers: { 'X-Api-Key': nusaworkAuthTokenApiKey },
  })
  return response.data.token
}

export async function fetchNusaworkEmployeePhoneNumbers(
  token: string,
): Promise<Record<string, string>> {
  const url = nusaworkEmployeeApiUrl
  const branches = ['2', '3', '4', '5']

  const payload = {
    fields: { id_branch: branches },
    page_count: 10000,
    paginate: true,
    multi_value: true,
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  const response = await axios.post(url, payload, { headers })
  const employees = response.data.data.list
  const employeePhoneNumbers: Record<string, string> = {}
  employees.forEach((employee: any) => {
    if (employee.active_status !== 'Active') return
    const formattedPhoneNumber = formatPhoneNumber(
      employee.whatsapp || employee.mobile_phone,
    )
    if (formattedPhoneNumber) {
      employeePhoneNumbers[employee.employee_id] = formattedPhoneNumber
    }
  })
  return employeePhoneNumbers
}

export async function syncNusacontactContact(data: any): Promise<void> {
  if (!nusacontactSyncContactApiUrl) {
    return
  }
  let attempt = 0
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))
  while (attempt < +nusacontactSyncContactMaxAttempts) {
    try {
      await axios.post(nusacontactSyncContactApiUrl, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': nusacontactApiKey,
        },
      })
      break
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          attempt++
          if (attempt < +nusacontactSyncContactMaxAttempts) {
            await delay(1000)
          } else {
            // max retry reached
          }
        } else {
          // non retryable error occurred
          break
        }
      } else {
        // non axios error
        break
      }
    }
  }
}
