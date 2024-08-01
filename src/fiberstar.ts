import axios from "axios"
import { fiberstarAllowedCities, fiberstarHomepassApiEmail, fiberstarHomepassApiPassword, fiberstarHomepassApiUrl } from "./config"
import logger from "./logger"
import { deleteFiberstarHomepass, fetchFiberstarConfig, fetchFiberstarHomepass, saveFiberstarConfig, saveFiberstarHomepass, updateFiberstarHomepass } from "./database";
import { log } from "console";

enum FiberstarEndpoint {
    API_AUTH_TOKEN = '/auth/token',
    API_LIST_RFS = '/api/v1/list-projectid',
    API_HOMEPASS_DETAILS = '/api/v1/homepassed-list',
    API_TIPE_HOMEPASS = '/api/v1/listtipehomepass',
    API_KOTA = '/api/v1/listkota',
    API_UPDATED_HOMEPASS = '/api/v1/updated-hp-list',
    API_DELETED_HOMEPASS = '/api/v1/deleted-hp-list',
}

enum FiberstarConfigKeys {
    AUTH_TOKEN = 'auth_token',
    CITIES = 'cities',
    HOMEPASS_TYPES = 'homepass_types',
}

const lastRequest = (async (kota: string) => {
    const result = await fetchFiberstarConfig('last_request')
    if (result != undefined) {
        const lastRequest = JSON.parse(result.config_value)
        lastRequest.forEach((city: any) => {
            if (city.city == kota) {
                return new Date(city.last_request)
            }
        })
    }
    const today = new Date()
    return new Date(today.getTime() - (6 * 24 * 60 * 60 * 1000))
})

const formatDate = (async (date: Date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
});

export async function getFiberstarHomepass() {
    try {
        const allowedCities = JSON.parse(fiberstarAllowedCities)
        const cities = await getFiberstarCities()
        const types = await getFiberstarHomepassType()
        const currentDate = await formatDate(new Date())

        const cityConf: any[] = []
        cities.forEach(async (city: any) => {
            if (allowedCities.includes(city.kota)) {
                types.forEach(async (tipe: any) => {
                    const lastDate = await lastRequest(city.kota)
                    const body = {
                        'start_date': await formatDate(lastDate),
                        'end_date': currentDate,
                        'tipe_homepass': tipe.resident_type,
                        'kota': city.kota,
                    }
                    await getFiberstarHomepassDetails(body, 1)
                    await getFiberstarDeletedHomepass(body, 1)
                    await getFiberstarUpdatedHomepass(body, 1)
                })

                cityConf.push({
                    city: city.kota,
                    last_request: currentDate
                })
            }
        })

        await saveFiberstarConfig('last_request', JSON.stringify(cityConf))
    } catch (error: any) {
        console.log(error.message, 'fetch homepass')
    }
}

function getAxiosInstance(): any {
    const newAxios = axios.create({
        baseURL: fiberstarHomepassApiUrl,
        headers: {
            'Content-Type': 'application/json',
        },
    })

    newAxios.interceptors.request.use(async (config) => {
        config.baseURL = fiberstarHomepassApiUrl
        if (config.url != FiberstarEndpoint.API_AUTH_TOKEN) {
            const result = await fetchFiberstarConfig(FiberstarConfigKeys.AUTH_TOKEN)
            if (result != undefined) {
                const authResponse = JSON.parse(result.config_value)
                if (authResponse.time_request != undefined) {
                    const timeRequest = new Date(authResponse.time_request)
                    const timeNow = new Date()
                    const diff = Math.floor((timeNow.getTime() - timeRequest.getTime()) / 1000)
                    if (diff < authResponse.expires_in) {
                        config.headers['Authorization'] = `Bearer ${authResponse.token}`
                        return config
                    }
                }
            }

            const token = await login()
            config.headers['Authorization'] = `Bearer ${token}`
        }
        return config
    });
    return newAxios
}

async function login(): Promise<any> {
    try {
        const token = Buffer.from(`${fiberstarHomepassApiEmail}:${fiberstarHomepassApiPassword}`).toString('base64')
        const response = await getAxiosInstance().post(FiberstarEndpoint.API_AUTH_TOKEN, {}, {
            headers: {
                'Authorization': `Basic ${token}`,
            },
        })
        const result = response.data
        result.time_request = new Date()
        await saveFiberstarConfig(FiberstarConfigKeys.AUTH_TOKEN, result)
        return response.data.token
    } catch (error: any) {
        console.log(error)
        return Promise.reject(error)
    }
}

async function getFiberstarCities(): Promise<any> {
    try {
        const cities = await getAxiosInstance().get(FiberstarEndpoint.API_KOTA)
        await saveFiberstarConfig(FiberstarConfigKeys.CITIES, cities.data.message)
        return cities.data.message
    } catch (error: any) {
        console.log(error.message, 'cities')
        const localCities = await fetchFiberstarConfig(FiberstarConfigKeys.CITIES)
        if (localCities != undefined) {
            return JSON.parse(localCities.config_value)
        }
    }
}

async function getFiberstarHomepassType(): Promise<any> {
    try {
        const homepassTypes = await getAxiosInstance().get(FiberstarEndpoint.API_TIPE_HOMEPASS)
        await saveFiberstarConfig(FiberstarConfigKeys.HOMEPASS_TYPES, homepassTypes.data.message)
        return homepassTypes.data.message
    } catch (error: any) {
        console.log(error.message, 'homepass types')
        const localTypes = await fetchFiberstarConfig(FiberstarConfigKeys.HOMEPASS_TYPES)
        if (localTypes != undefined) {
            return JSON.parse(localTypes.config_value)
        }
    }
}

async function getFiberstarHomepassDetails(body: any, page: number) {
    try {
        const response = await getAxiosInstance().post(FiberstarEndpoint.API_HOMEPASS_DETAILS, body, {
            params: {
                "page": page,
            },
        })

        response.data.message.data.forEach(async (data: any) => {
            const address = await homeAddress(data)
            const rfsDate = new Date(data.rfs_date).getTime() / 1000

            const homepassId = await fetchFiberstarHomepass('fiberstar', data.homepass_id, 'homepass')
            if (homepassId != undefined && homepassId > 0) {
                await updateFiberstarHomepass(homepassId, data.homepassed_coordinate, data.homepass_id, address, 'homepass', rfsDate)
            } else {
                await saveFiberstarHomepass(data.homepassed_coordinate, data.homepass_id, address, 'homepass', rfsDate)
            }

            const splitterId = await fetchFiberstarHomepass('fiberstar', data.splitter_id, 'splitter')
            if (splitterId != undefined && splitterId > 0) {
                await updateFiberstarHomepass(splitterId, data.spliter_distribusi_koordinat, data.splitter_id, address, 'splitter', rfsDate)
            } else {
                await saveFiberstarHomepass(data.spliter_distribusi_koordinat, data.splitter_id, address, 'splitter', rfsDate)
            }
        })
        if (response.data.message.current_page < response.data.message.last_page) {
            await getFiberstarHomepassDetails(body, page + 1)
        }
    } catch (error: any) {
        console.log(error.message, 'homepass details')
    }
}

async function getFiberstarUpdatedHomepass(body: any, page: number) {
    try {
        const response = await getAxiosInstance().post(FiberstarEndpoint.API_UPDATED_HOMEPASS, body, {
            params: {
                "page": page,
            },
        })

        response.data.message.data.forEach(async (data: any) => {
            const address = await homeAddress(data)
            const updateDate = new Date(data.updated_date).getTime() / 1000
            const coordinate = data.homepassed_coordinate.replace(/ /g, ',')

            const homepassId = await fetchFiberstarHomepass('fiberstar', data.homepass_id, 'homepass')
            if (homepassId != undefined && homepassId > 0) {
                await updateFiberstarHomepass(homepassId, coordinate, data.homepass_id, address, 'homepass', updateDate)
            } else {
                await saveFiberstarHomepass(coordinate, data.homepass_id, address, 'homepass', updateDate)
            }
        })

        if (response.data.message.current_page < response.data.message.last_page) {
            await getFiberstarUpdatedHomepass(body, page + 1)
        }
    } catch (error: any) {
        console.log(error.message, 'updated homepass')
    }
}

async function getFiberstarDeletedHomepass(body: any, page: number) {
    try {
        const response = await getAxiosInstance().post(FiberstarEndpoint.API_DELETED_HOMEPASS, body, {
            params: {
                "page": page,
            },
        })

        response.data.message.data.forEach(async (data: any) => {
            const homepassId = await fetchFiberstarHomepass('fiberstar', data.homepass_id, 'homepass')
            if (homepassId != undefined && homepassId > 0) {
                await deleteFiberstarHomepass('fiberstar', data.homepass_id, 'homepass')
            }
        })

        if (response.data.message.current_page < response.data.message.last_page) {
            await getFiberstarDeletedHomepass(body, page + 1)
        }
    } catch (error: any) {
        console.log(error.message, 'deleted homepass')
    }
}

async function homeAddress(homepass: any): Promise<string> {
    const homeType = homepass.resident_type
    const homeName = homepass.resident_name
    const streetName = homepass.street_name
    const homeNo = homepass.no
    var homeUnit =  ''
    if (homeUnit != null && homepass.unit.toLowerCase() != 'null') {
        homeUnit = ` Unit ${homepass.unit}`
    }
    const subDistrict = homepass.sub_district
    const district = homepass.district
    const city = homepass.city
    const province = homepass.province
    const postalCode = homepass.postal_code
    return `${homeType} ${homeName} ${streetName} No. ${homeNo}${homeUnit}, ${subDistrict}, ${district}, ${city}, ${province} ${postalCode}`
}