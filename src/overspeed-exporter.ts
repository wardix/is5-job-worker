import fs from 'fs'
import path from 'path'
import {
  overSpeedBlockedSubscriberMetricFilePath,
  overSpeedBlockedSubscriberMetricName,
  overSpeedBlockedSubscriberThreshold,
} from './config'
import { fetchBlockedSubscriberGraphs, findOverSpeedGraphs } from './database'

export async function generateOverSpeedBlockedSubscriberMetrics(): Promise<void> {
  const metricName = overSpeedBlockedSubscriberMetricName
  const metricFilePath = overSpeedBlockedSubscriberMetricFilePath
  const subscribersGraphMap = await fetchBlockedSubscriberGraphs()
  const graphIds: number[] = []
  for (const graphId in subscribersGraphMap) {
    graphIds.push(+graphId)
  }
  const overSpeedGraphs = await findOverSpeedGraphs(
    graphIds,
    +overSpeedBlockedSubscriberThreshold,
  )
  const overSpeedSubscriberIds: number[] = []
  const overSpeedSubscribers: any[] = []
  for (const subscribers of overSpeedGraphs.map(
    (e) => subscribersGraphMap[`${e}`],
  )) {
    if (subscribers == null) {
      continue
    }
    for (const subscriber of subscribers) {
      if (overSpeedSubscriberIds.includes(subscriber.csid)) {
        continue
      }
      overSpeedSubscriberIds.push(subscriber.csid)
      overSpeedSubscribers.push(subscriber)
    }
  }
  const output: string[] = []
  overSpeedSubscribers.forEach(({ csid, acc }) => {
    output.push(`${metricName}{csid="${csid}",acc="${acc}"} 1`)
  })
  const metricDirectoryPath = path.dirname(metricFilePath)
  const tempDirectoryPath = fs.mkdtempSync(
    path.join(metricDirectoryPath, 'temp-'),
  )
  const tempFilePath = path.join(tempDirectoryPath, 'tempfile.txt')
  fs.writeFileSync(tempFilePath, output.join('\n'))

  fs.renameSync(tempFilePath, metricFilePath)
  fs.rmdirSync(tempDirectoryPath)
}
