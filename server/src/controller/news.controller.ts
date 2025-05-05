import { Request, Response } from "express";
import { PinataSDK } from "pinata";
import { File } from "node:buffer";
import { catchAsync } from "../utils/catchAsyncHandler.js";
import { AppError } from "../utils/appErrors.js";
import { Account, Aptos, AptosConfig, Network, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { News } from "../model/news.model.js";

const MODULE_ADDRESS = process.env.MODULE_ADDRESS ?? "";
const MODULE_NAME = "news";
const pinataJwt = process.env.PINATA_JWT ?? "";
const gatewayUrl = process.env.PINATA_GATEWAY_URL ?? "";

const pinata = new PinataSDK({
    pinataJwt,
    pinataGateway: gatewayUrl,
});

const aptosConfig = new AptosConfig({ network: Network.TESTNET });
const aptos = new Aptos(aptosConfig);

export const createNews = catchAsync(async (req: Request, res: Response) => {
    const files = req.files as { thumbnail?: Express.Multer.File[]; files?: Express.Multer.File[] };
    const newsData = req.body;

    if (!pinataJwt || !gatewayUrl) {
        throw new AppError("Pinata credentials not set", 500);
    }

    if (!process.env.APTOS_PRIVATE_KEY || !MODULE_ADDRESS) {
        throw new AppError("Aptos credentials not set", 500);
    }

    // IPFS Handling

    const mainFileCids: string[] = [];
    if (files.files && files.files.length > 0) {
        for (const file of files.files) {
            const result = await pinata.upload.public.file(
                new File([file.buffer], file.originalname, { type: file.mimetype }) as any
            );
            mainFileCids.push(result.cid);
        }
    }

    let thumbnailCid: string | null = null;
    if (files.thumbnail && files.thumbnail.length > 0) {
        const thumbFile = files.thumbnail[0];
        const thumbResult = await pinata.upload.public.file(
            new File([thumbFile.buffer], thumbFile.originalname, { type: thumbFile.mimetype }) as any
        );
        thumbnailCid = thumbResult.cid;
    }

    newsData.files = mainFileCids.map((cid) => `${gatewayUrl}/ipfs/${cid}`);
    newsData.thumbnail = thumbnailCid ? `${gatewayUrl}/ipfs/${thumbnailCid}` : null;

    // LLM handling

    const formData = new FormData();
    formData.append("title", newsData.title);
    formData.append("description", newsData.description);

    if (files.thumbnail && files.thumbnail.length > 0) {
        const thumbFile = files.thumbnail[0];
        const thumbFileToUpload = new File([thumbFile.buffer], thumbFile.originalname, { type: thumbFile.mimetype });
        formData.append('thumbnail', thumbFileToUpload as any);
    }

    if (files.files && Array.isArray(files.files) && files.files.length > 0) {
        files.files.forEach((file, index) => {
            const fileToUpload = new File([file.buffer], file.originalname, { type: file.mimetype });
            formData.append(`files[${index}]`, fileToUpload as any);
        });
    }

    let llmResponse;

    const response = await fetch('http://127.0.0.1:5000/news/insights', {
        method: 'POST',
        body: formData
    });

    llmResponse = await response.json();

    if (llmResponse.status === "false")
        throw new AppError(llmResponse.error ?? "Failed to create news", 404)


    // Aptos Handling

    const privateKeyHex = process.env.APTOS_PRIVATE_KEY;
    const privateKeyBytes = Buffer.from(privateKeyHex.replace('0x', ''), 'hex');
    const privateKey = new Ed25519PrivateKey(privateKeyBytes);

    let account;
    try {
        account = Account.fromPrivateKey({ privateKey });
    } catch (error) {
        throw new AppError("Invalid Aptos private key", 500);
    }

    const transactionToSimulate = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::create_news`,
            typeArguments: [],
            functionArguments: [newsData.title, newsData.description, newsData.files, newsData.thumbnail || null,],
        },
    });

    const [simulation] = await aptos.transaction.simulate.simple({
        signerPublicKey: account.publicKey,
        transaction: transactionToSimulate,
    });

    if (!simulation) {
        throw new AppError("Simulation result is empty", 500);
    }

    if (!simulation.success) {
        const errorMessage = simulation.vm_status.includes("EINSUFFICIENT_BALANCE") ? "Insufficient account balance for transaction" : `Transaction simulation failed: ${simulation.vm_status}`;
        throw new AppError(errorMessage, 500);
    }

    const gasUsed = parseInt(simulation.gas_used, 10);

    if (isNaN(gasUsed)) {
        throw new AppError("Invalid gas_used value in simulation result", 500);
    }

    const maxGasAmount = Math.ceil(gasUsed * 1.2);

    const gasPrice = await aptos.getGasPriceEstimation();

    const finalTransaction = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
            function: `${MODULE_ADDRESS}::${MODULE_NAME}::create_news`,
            typeArguments: [],
            functionArguments: [newsData.title, newsData.description, newsData.files, newsData.thumbnail || null,],
        },
        options: { maxGasAmount, gasUnitPrice: gasPrice.gas_estimate, },
    });

    const pendingTransaction = await aptos.signAndSubmitTransaction({ signer: account, transaction: finalTransaction, });

    const result = await aptos.waitForTransaction({ transactionHash: pendingTransaction.hash });

    if (!result.success) {
        throw new AppError(`Transaction failed: ${result.vm_status}`, 500);
    }

    // MondoDB handling

    const news = new News({ ...newsData, ...llmResponse });

    await news.save();

    res.status(201).json({ success: true, message: "News created successfully", news, txnhash: `https://explorer.aptoslabs.com/txn/${pendingTransaction.hash}/payload?network=testnet` });
});

export const getNews = catchAsync(async (_req: Request, res: Response) => {
    const collection = await aptos.getAccountResource({
        accountAddress: MODULE_ADDRESS,
        resourceType: `${MODULE_ADDRESS}::${MODULE_NAME}::NewsCollection`,
    });

    res.status(200).json({ success: true, newsItems: collection.news_items });
});