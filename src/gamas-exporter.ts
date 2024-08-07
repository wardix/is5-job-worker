import path from 'path'
import fs from 'fs'
import axios from 'axios'
import {
  gamasAlertApiUrl,
  gamasMassIncidentCountThreshold,
  gamasMassIncidentPeriodSeconds,
  gamasMaxIncidentAgeSeconds,
  gamasMetricFilePath,
  gamasMetricName,
} from './config'

export async function generateGamasMetrics(): Promise<void> {
  const isWithinTolerance = (
    date1: string,
    date2: string,
    toleranceSeconds: number,
  ) =>
    Math.abs(new Date(date1).getTime() - new Date(date2).getTime()) <=
    toleranceSeconds * 1000
  const response = await axios.get(gamasAlertApiUrl)
  const alerts = response.data.length > 0 ? response.data[0].alerts : []

  const incidents: any[] = []
  const incidentGroups: any[] = []

  alerts.forEach(({ startsAt, labels: { host, link, region } }: any) => {
    incidents.push({ startsAt, host, link, region })
  })

  incidents.sort((a: any, b: any): number => {
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  })

  incidents
    .filter(({ startsAt }) => {
      return isWithinTolerance(
        startsAt,
        new Date().toISOString(),
        +gamasMaxIncidentAgeSeconds,
      )
    })
    .forEach(({ startsAt, host, link, region }) => {
      const startsAtDate = new Date(startsAt)
      const group = incidentGroups.find(
        ({
          startsAtMin,
          startsAtMax,
          region: groupRegion,
          link: groupLink,
        }) => {
          return (
            groupRegion === region &&
            groupLink === link &&
            (isWithinTolerance(
              startsAtMin,
              startsAt,
              +gamasMassIncidentPeriodSeconds,
            ) ||
              isWithinTolerance(
                startsAtMax,
                startsAt,
                +gamasMassIncidentPeriodSeconds,
              ))
          )
        },
      )

      if (group) {
        if (group.hosts.includes(host)) {
          return
        }
        group.hosts.push(host)
        group.count++
        group.startsAtMin = new Date(
          Math.min(
            new Date(group.startsAtMin).getTime(),
            startsAtDate.getTime(),
          ),
        ).toISOString()
        group.startsAtMax = new Date(
          Math.max(
            new Date(group.startsAtMax).getTime(),
            startsAtDate.getTime(),
          ),
        ).toISOString()
        return
      }
      incidentGroups.push({
        region,
        link,
        hosts: [host],
        count: 1,
        startsAtMin: startsAt,
        startsAtMax: startsAt,
      })
    })

  const output: string[] = []

  for (const { region, link, count, startsAtMin } of incidentGroups.filter(
    ({ count }) => count > gamasMassIncidentCountThreshold,
  )) {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const [day, month, year, time] = formatter
      .format(new Date(startsAtMin))
      .split(/[\s,/]+/)
    const startTime = `${year}-${month}-${day} ${time}`
    output.push(
      `${gamasMetricName}{region="${region}",link="${link}",start="${startTime}"} ${count}`,
    )
  }

  const metricDirectoryPath = path.dirname(gamasMetricFilePath)
  const tempDirectoryPath = fs.mkdtempSync(
    path.join(metricDirectoryPath, 'temp-'),
  )
  const tempFilePath = path.join(tempDirectoryPath, 'tempfile.txt')
  fs.writeFileSync(tempFilePath, output.join('\n'))

  fs.renameSync(tempFilePath, gamasMetricFilePath)
  fs.rmdirSync(tempDirectoryPath)
}
