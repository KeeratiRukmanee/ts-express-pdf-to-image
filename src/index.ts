import { exec } from "node:child_process";
import fs from 'fs';
import path from 'path';
import express from 'express';
import multer from 'multer'
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid'
import _ from 'lodash'
import sharp from 'sharp';
import gm from 'gm';

const app = express();
const PORT = 3000;

const upload = multer()
app.use(cors())
app.use('/static', express.static(path.join(__dirname, 'storage')))

interface ResponseDTO {
    requestId: any
    success: boolean
    message: string
    data: any
}

app.get('/', (req, res) => {
    res.send('Hello, TypeScript Express App!');
});

//// test node gm
// app.get('/gm', (req, res) => {
//     const GM = gm.subClass({ appPath: '/usr/bin/' });
//     GM('output.jpg')
//         .identify(function (err, data) {
//             if (!err) console.log(data)
//         });
//     res.send('Hello, TypeScript Express App!');
// });

app.get('/page/:workBookId/:page', async (req, res) => {

    const workBookId = req.params.workBookId
    const page = parseInt(req.params.page)

    const tmpDir: string = `${__dirname}/storage/${workBookId}/tmp`
    const files = fs.readdirSync(tmpDir)

    const fileName = files[page - 1]
    const filePath = `${tmpDir}/${fileName}`

    // sharp
    const image = sharp(filePath)
    const metadata = await image.metadata()

    const resp: ResponseDTO = {
        requestId: uuidv4(),
        success: true,
        message: "get image success",
        data: {
            file: `/static/${workBookId}/tmp/${fileName}`,
            info: metadata,
        }
    }

    res.json(resp)
});

app.get('/thumb/:workBookId/:page/:row', async (req, res) => {

    const workBookId = req.params.workBookId
    const page = parseInt(req.params.page)
    const row = parseInt(req.params.row)

    const tmpDir: string = `${__dirname}/storage/${workBookId}/thumbnail`
    const files = fs.readdirSync(tmpDir)

    const start_index = (page - 1) * row
    const end_index = start_index + row
    const resPage = files.slice(start_index, end_index);

    const resp: ResponseDTO = {
        requestId: uuidv4(),
        success: true,
        message: "get image thumbnail success",
        data: {
            page: page,
            row: row,
            total: files.length,
            files: resPage.map((page => { return `/static/${workBookId}/thumbnail/${page}` })),
        }
    }

    res.json(resp)
});

app.post('/convert', upload.single('file'), (req, res) => {

    // validate if form have file
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file

    // generate workBook id
    const workBookId = uuidv4()

    // workBook directory
    const newDir: string = `${__dirname}/storage/${workBookId}`

    // origin PDF file directory
    const originDir: string = `${__dirname}/storage/${workBookId}/origin`

    // tmp directory
    const tmpDir: string = `${__dirname}/storage/${workBookId}/tmp`

    // thumbnail directory
    const thumpDir: string = `${__dirname}/storage/${workBookId}/thumbnail`

    // path to save origin PDF file // replace space with _
    const filePath = path.join(originDir, file.originalname.replace(/ /g, "_"))

    // create directory 
    fs.mkdirSync(newDir)
    fs.mkdirSync(originDir)
    fs.mkdirSync(tmpDir)
    fs.mkdirSync(thumpDir)

    // write origin PDF file from buffer
    fs.writeFile(filePath, file.buffer, (error) => {
        if (error) {
            res.json({ error: error })
        }
    })

    // convert PDF file to multiple image files (JPG)
    exec(`gm convert -density 200 -quality 75% ${filePath} +adjoin ${tmpDir}/${workBookId}-%03d.jpg`, (error, stdout, stderr) => {
        if (error) {
            // node couldn't execute the command
            //TODO delete file and folder when error
            res.json({ error: error })
        }

        // list all files in tmp directory
        const files = fs.readdirSync(tmpDir)

        let allFiles: String[] = []

        for (let i = 0; i < files.length; i++) {

            // %03d 001 format
            const fileIdx = _.padStart(i.toString(), 3, '0')

            // generate thumbnail files
            exec(`gm convert ${tmpDir}/${workBookId}-${fileIdx}.jpg -thumbnail 200x ${thumpDir}/${workBookId}-thumbnail-${fileIdx}.jpg`, (error, stdout, stderr) => {
                if (error) {
                    // node couldn't execute the command
                    //TODO delete file and folder when error
                    res.json({ error: error })
                }
            })
        }


        const resp: ResponseDTO = {
            requestId: workBookId,
            success: true,
            message: "upload and convert to image success",
            data: {
                pages: files.length,
            }
        }

        res.json(resp)
    });

});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

