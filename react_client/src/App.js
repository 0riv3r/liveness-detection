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

// Face analysis by Amazon Rekognition
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

const getNumberOfPeople = (rekognizeResult) => {
  return (rekognizeResult.FaceDetails).length;
};

// Analysis results: Confidence level
const getConfidence = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].Confidence;
};

// Analysis results: LowAge（estimated low age range)
const getLowAge = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].AgeRange?.Low;
};

// Analysis results: HighAge（estimated high age range)
const getHighAge = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].AgeRange?.High;
};

// Analysis results: Eyeglasses
const getIsWearingEyeGlasses = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].Eyeglasses?.Value;
};

// Analysis results: Sunglasses
const getIsWearingSunGlasses = (rekognizeResult) => {
  return (rekognizeResult.FaceDetails)[0].Sunglasses?.Value;
};

// Analysis results: Smile
const getIsSmiling = (rekognizeResult) => {
  return (rekognizeResult.FaceDetails)[0].Smile?.Value;
};

// Analysis results: Left Eye
const getEyeLeft = (rekognizeResult) => {
  return (rekognizeResult.FaceDetails)[0].Landmarks[0].Type?.Value;
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
      <header className="header">
        <h1>Liveness Detection</h1>
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
          {/* <div>{rekognizeHandler()}</div> */}
          {/* <div>{setUrl(undefined)}</div> */}
          {/* <div>
            {
              setInterval(function() {
                rekognizeHandler()
              }, 10000)
            }
          </div> */}
          <div>
            <button onClick={() => rekognizeHandler()}>Analyze</button>
          </div>
          {/* <div>
            <img src={url} alt="Screenshot" />
          </div> */}
          {typeof rekognizeResult !== "undefined" && (
            <div className="rekognizeResult">
              <div>{"Number of People: " + getNumberOfPeople(rekognizeResult)}</div>
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
              <div>
                {"Smile: " + getIsSmiling(rekognizeResult)}
              </div>
              <div>
                {"getEyeLeft: " + getEyeLeft(rekognizeResult)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;