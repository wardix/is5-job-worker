import axios from 'axios'
import {
  nusaworkAuthTokenApiUrl,
  nusaworkAuthTokenApiKey,
  nusaworkEmployeeApiUrl,
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
