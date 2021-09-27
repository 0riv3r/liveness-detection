import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import AWS from "aws-sdk";

const videoConstraints = {
  width: 720,
  height: 360,
  facingMode: "user",
};

/*
https://create-react-app.dev/docs/adding-custom-environment-variables/
https://create-react-app.dev/docs/adding-custom-environment-variables/#adding-development-environment-variables-in-env
https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html
*/
AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.REACT_APP_AWS_SESSION_TOKEN,
  region: process.env.REACT_APP_AWS_REGION
});
//console.log(`AWS.config.accessKeyId: ${AWS.config.credentials?.accessKeyId}`);
console.log(`AWS.config.region: ${AWS.config.region}`);

const rekognitionClient = new AWS.Rekognition({
  apiVersion: "2016-06-27",
});

//Amazon Rekognitionによる顔分析
const detectFaces = async (imageData) => {
  const params = {
    Image: {
      Bytes: Buffer.from(
        imageData.replace("data:image/jpeg;base64,", ""),
        "base64"
      ),
    },
    Attributes: ["ALL"],
  };
  return await rekognitionClient.detectFaces(params).promise();
};

//分析結果からConfidence（分析結果の信頼度）取得
const getConfidence = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].Confidence;
};

//分析結果からLowAge（推測される年齢範囲の加減）取得
const getLowAge = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].AgeRange?.Low;
};

//分析結果からHighAge（推測される年齢範囲の上限）取得
const getHighAge = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].AgeRange?.High;
};

//分析結果からEyeglasses（眼鏡を掛けているか）取得
const getIsWearingEyeGlasses = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].Eyeglasses?.Value;
};

// Are you wearing sunglasses?
const getIsWearingSunGlasses = (rekognizeResult) => {
  return (rekognizeResult.FaceDetails)[0].Sunglasses?.Value;
};

const App = () => {

  const webcamRef = useRef(null);
  const [url, setUrl] = useState(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setUrl(imageSrc);
      setRekognizeResult(undefined);
    }
  }, [webcamRef]);

  const [rekognizeResult, setRekognizeResult] = useState();
  const rekognizeHandler = async () => {
    const result = await detectFaces(url);
    setRekognizeResult(result);
    console.log(result);
  };

  return (
    <div className="App">
      <header>
        <h1>Camera app（With face analysis）</h1>
      </header>       
      {(
      <>
        <div className="webcam">
          <Webcam
            audio={false}
            width={540}
            height={360}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
          />
        </div>
        <button onClick={capture}>Capture!</button>
      </>
      )}
      {url && (
        <>
          <div>
            <button
              onClick={() => {
                setUrl(null);
                setRekognizeResult(undefined);
              }}
            >
              Delete
            </button>
            <button onClick={() => rekognizeHandler()}>Analyze</button>
          </div>
          <div>
            <img src={url} alt="Screenshot" />
          </div>
          {typeof rekognizeResult !== "undefined" && (
            <div className="rekognizeResult">
              <div>{"Confidence: " + getConfidence(rekognizeResult)}</div>
              <div>
                {"AgeRange: " +
                  getLowAge(rekognizeResult) +
                  " ~ " +
                  getHighAge(rekognizeResult)}
              </div>
              <div>
                {"Eyeglasses: " + getIsWearingEyeGlasses(rekognizeResult)}
              </div>
              <div>
                {"Sunglasses: " + getIsWearingSunGlasses(rekognizeResult)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;