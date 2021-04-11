const aws = require("aws-sdk");
const thumbnail = require("@courselit/thumbnail");
const { createReadStream, rmdirSync } = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const {
  cloudEndpoint,
  cloudKey,
  cloudSecret,
  cloudBucket,
  cloudRegion,
  cloudCdnEndpoint,
} = require("../../config/constants");
const { responses } = require("../../config/strings");
const {
  uniqueFileNameGenerator,
  convertToWebp,
  foldersExist,
  createFolders,
  moveFile,
} = require("../../lib/utils");
const constants = require("../../config/constants.js");
const Media = require("../../models/Media.js");

const putObjectPromise = (params) =>
  new Promise((resolve, reject) => {
    const endpoint = new aws.Endpoint(cloudEndpoint);
    const s3 = new aws.S3({
      endpoint,
      accessKeyId: cloudKey,
      secretAccessKey: cloudSecret,
    });

    s3.putObject(
      Object.assign(
        {},
        {
          Bucket: cloudBucket,
          ACL: "public-read",
        },
        params
      ),
      (err, result) => {
        if (err) reject(err);
        resolve(result);
      }
    );
  });

const generateAndUploadThumbnail = async ({
  workingDirectory,
  cloudDirectory,
  mimetype,
  originalFilePath,
}) => {
  const imagePattern = /image/;
  const videoPattern = /video/;
  const thumbPath = `${workingDirectory}/thumb.webp`;

  let isThumbGenerated = false; // to indicate if the thumbnail name is to be saved to the DB
  if (imagePattern.test(mimetype)) {
    await thumbnail.forImage(originalFilePath, thumbPath, {
      width: constants.thumbnailWidth,
    });
    await convertToWebp(thumbPath);
    isThumbGenerated = true;
  }
  if (videoPattern.test(mimetype)) {
    await thumbnail.forVideo(originalFilePath, thumbPath, {
      width: constants.thumbnailWidth,
      height: constants.thumbnailHeight,
    });
    await convertToWebp(thumbPath);
    isThumbGenerated = true;
  }

  if (isThumbGenerated) {
    await putObjectPromise({
      Key: `${cloudDirectory}/thumb.webp`,
      Body: createReadStream(thumbPath),
      ContentType: "image/webp",
    });
  }

  return isThumbGenerated;
};

exports.upload = async (req, res) => {
  const data = req.body;
  const { file } = req.files;
  const fileName = uniqueFileNameGenerator(file.name);

  const temporaryFolderForWork = `/tmp/${fileName.name}`;
  if (!foldersExist([temporaryFolderForWork])) {
    createFolders([temporaryFolderForWork]);
  }

  const mainFilePath = `${temporaryFolderForWork}/${file.name}.${fileName.ext}`;
  const cloudFolder = `${req.subdomain.name}/${req.user.userId}/${fileName.name}`;
  try {
    await moveFile(req.files.file, mainFilePath);

    const fileNameWithDomainInfo = `${cloudFolder}/main.${fileName.ext}`;
    await putObjectPromise({
      Key: fileNameWithDomainInfo,
      Body: file.data,
      ContentType: file.mimetype,
    });

    const isThumbGenerated = await generateAndUploadThumbnail({
      workingDirectory: temporaryFolderForWork,
      cloudDirectory: cloudFolder,
      mimetype: file.mimetype,
      originalFilePath: mainFilePath,
    });

    rmdirSync(temporaryFolderForWork, { recursive: true });

    const mediaObject = {
      domain: req.subdomain._id,
      originalFileName: file.name,
      file: fileNameWithDomainInfo,
      mimeType: req.files.file.mimetype,
      size: req.files.file.size,
      creatorId: req.user._id,
      thumbnail: isThumbGenerated ? `${cloudFolder}/thumb.webp` : "",
      altText: data.altText,
    };

    const media = await Media.create(mediaObject);

    return res.status(200).json({
      message: responses.success,
      media: {
        id: media.id,
        originalFileName: mediaObject.originalFileName,
        mimeType: mediaObject.mimeType,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.generateSignedUrl = async ({ name, mimetype }) => {
  const client = new S3Client({
    region: cloudRegion,
    endpoint: cloudEndpoint,
    credentials: {
      accessKeyId: cloudKey,
      secretAccessKey: cloudSecret,
    },
  });

  const command = new PutObjectCommand({
    ACL: "public-read",
    Bucket: cloudBucket,
    Key: name,
    ContentType: mimetype,
  });

  return await getSignedUrl(client, command);
};

exports.serve = async ({ media, res }) => {
  res.status(200).json({
    media: {
      id: media.id,
      file: `${cloudCdnEndpoint}/${media.file}`,
      thumbnail: media.thumbnail
        ? `${cloudCdnEndpoint}/${media.thumbnail}`
        : "",
      altText: media.altText,
    },
  });
};