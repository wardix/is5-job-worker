import axios from 'axios'
import {
  nusaworkAuthTokenApiUrl,
  nusaworkAuthTokenApiKey,
  nusaworkEmployeeApiUrl,
  nusacontactSyncContactApiUrl,
  nusacontactApiKey,
  nusacontactSyncContactMaxAttempts,
  nusaworkAttendanceApiUrl,
  visitCardSummaryApiUrl,
  visitCardToken,
  waNotificationApiUrl,
  waNotificationApiKey,
} from './config'
import { formatPhoneNumber } from './utils'

export async function sendWaNotification({
  to,
  msg,
}: {
  to: string
  msg: string
}): Promise<void> {
  const payload = { to, type: 'text', msg }
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': waNotificationApiKey,
  }
  await axios.post(waNotificationApiUrl, payload, { headers })
}

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

export async function fetchNusaworkPresentEngineers(
  engineerMap: any,
): Promise<string[]> {
  const presentEngineers: string[] = []

  const nusaworkToken = await fetchNusaworkAuthToken()
  const nusaworkResponse = await axios.get(nusaworkAttendanceApiUrl, {
    headers: {
      Authorization: `Bearer ${nusaworkToken}`,
      Accept: 'application/json',
    },
    params: {
      status: 'working,clock_out',
      id_branch: '5',
      id_department: '31',
      sort_by: 'name',
      order_by: 'asc',
    },
  })

  const nusaworkPresentEngineers = nusaworkResponse.data.data

  for (const employeeId in engineerMap) {
    if (
      nusaworkPresentEngineers.some((e: any) => e.employee_id === employeeId)
    ) {
      presentEngineers.push(employeeId)
    }
  }

  return presentEngineers
}

export async function fetchVisitCards(): Promise<any> {
  const visitcardResponse = await axios.get(visitCardSummaryApiUrl, {
    headers: {
      Authorization: `Bearer ${visitCardToken}`,
      Accept: 'application/json',
    },
    params: {
      status: '0,1,2,3',
      row: 'all',
    },
  })

  const visitcardCurrentUserTickets = visitcardResponse.data._embedded

  return visitcardCurrentUserTickets
}
