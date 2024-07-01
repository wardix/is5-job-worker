import axios from 'axios'
import { nusaworkAttendanceApiUrl, nusaworkAuthTokenApiKey, nusaworkAuthTokenApiUrl, nusaworkEmployeeApiUrl } from './config'
import logger from './logger'
import { formatPhoneNumber } from './utils'

export async function fetchNusaworkAuthToken(): Promise<string> {
  const response = await axios.get<{ token: string }>(nusaworkAuthTokenApiUrl, {
    headers: { 'X-Api-Key': nusaworkAuthTokenApiKey },
  })
  return response.data.token
}

export async function getAllEmployee() {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const formatedToday = `${yyyy}-${mm}-${dd}`

  const payload = {
    fields: {
      active_status: ['active'],
    },
    page_count: 10000,
    currentPage: 1,
    periods: [formatedToday, formatedToday],
  }

  try {
    const token = await fetchNusaworkAuthToken()
    const response = await axios.post(nusaworkEmployeeApiUrl, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    return response.data.data.list
  } catch (error: any) {
    logger.warning(`Error get all employee: ${error.message}`)
  }
}

export function getNusaworkEmployeePhoneNumbers(employees: any) {
  const employeePhoneNumbers: Record<string, string> = {}
  employees.forEach((employee: any) => {
    const formattedPhoneNumber = formatPhoneNumber(
      employee.whatsapp || employee.mobile_phone,
    )
    if (formattedPhoneNumber) {
      employeePhoneNumbers[employee.employee_id] = formattedPhoneNumber
    }
  })
  return employeePhoneNumbers
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
