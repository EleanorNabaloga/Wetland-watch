import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

export async function POST(req) {
  try {
    const { contentType } = await req.json();

    // Generate a random, collision-resistant filename
    const filename = `evidence_${Date.now()}_${crypto.randomBytes(8).toString("hex")}.jpg`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: filename,
      ContentType: contentType || "image/jpeg",
    });

    // Generate a URL that expires in 60 seconds
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    return NextResponse.json({
      uploadUrl: signedUrl,
      photoUrl: `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET_NAME}/${filename}`,
    });
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      { error: "Could not generate upload URL" },
      { status: 500 },
    );
  }
}
