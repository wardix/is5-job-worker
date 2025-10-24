import axios from 'axios'
import logger from './logger'
import { is5ApiKey, is5EmployeeApiUrl } from './config'

export async function getIs5Employee() {
    try {
    const response = await axios.get(is5EmployeeApiUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': is5ApiKey,
      },
      params: {
        is_active: 1,
        limit: 0,
      },
    })
    return response.data.data
  } catch (error: any) {
    logger.warning(`Error get employee is5: ${error.message}`)
  }
}