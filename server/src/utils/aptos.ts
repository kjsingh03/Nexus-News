// // utils/ipfs.ts
// import { Web3Storage, File } from 'web3.storage';

// export const uploadToIPFS = async (files: Express.Multer.File[]) => {
//     const client = new Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN! });
//     const fileObjects = files.map(f => new File([f.buffer], f.originalname));
//     const cid = await client.put(fileObjects);
//     return cid;
// };
