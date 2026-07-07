import type { NextApiRequest, NextApiResponse } from 'next'
import { getVersionsOfEachComponent } from '@utils/getVersionsOfEachComponent'
type ResponseData = {
    data: any
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData>
) {
    // const [packageName, version] = req.query
    try {
        
        const packageVersions = await getVersionsOfEachComponent()
        // const data = Array.from(packageVersions.entries());

        // console.log(packageVersions, "packageVersions")
        res.status(200).json({ data: packageVersions })

    } catch (error) {
        console.error(error)
        res.status(500).json({ data: "Error fetching git tags" })

    }
}