import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import AWS from "aws-sdk";

import { drawRect } from "./draw_rect";

const videoConstraints = {
  width: 540, //720,
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
  return rekognizeResult.FaceDetails.length;
};

// Analysis results: Confidence level
const getConfidence = (rekognizeResult) => {
    return rekognizeResult.FaceDetails[0].Confidence;
};

// Analysis results: LowAge（estimated low age range)
const getLowAge = (rekognizeResult) => {
    return rekognizeResult.FaceDetails[0].AgeRange.Low;
};

// Analysis results: HighAge（estimated high age range)
const getHighAge = (rekognizeResult) => {
    return rekognizeResult.FaceDetails[0].AgeRange.High;
};

// Analysis results: Eyeglasses
const getIsWearingEyeGlasses = (rekognizeResult) => {
    return (rekognizeResult.FaceDetails)[0].Eyeglasses.Value;
};

// Analysis results: Sunglasses
const getIsWearingSunGlasses = (rekognizeResult) => {
  return rekognizeResult.FaceDetails[0].Sunglasses.Value;
};

// Analysis results: Smile
const getIsSmile = (rekognizeResult) => {
  return rekognizeResult.FaceDetails[0].Smile.Value;
};

const getChinBottom = (rekognizeResult) => {
  // rekognizeResult.FaceDetails[0].Landmarks[27].Type ==> "chinBottom"
  const x = rekognizeResult.FaceDetails[0].Landmarks[27].X,
        y = rekognizeResult.FaceDetails[0].Landmarks[27].Y;
  return {x,y};
};

// const getFaceBoundingBox = (rekognizeResult) => {
//   return rekognizeResult.FaceDetails[0].BoundingBox;
//   /*
//   BoundingBox:
//   Height: 0.41345128417015076
//   Left: 0.39006850123405457
//   Top: 0.19800728559494019
//   Width: 0.13521090149879456
//   */
// }

// Analysis results: Left Eye
const getEyeLeft = (rekognizeResult) => {
  const x = rekognizeResult.FaceDetails[0].Landmarks[0].X,
        y = rekognizeResult.FaceDetails[0].Landmarks[0].Y;

  return {x,y};
};

const App = () => {

  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
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

  const rect = (x, y, width=40, height=20) => {
    // Get Video Properties
    //const video = webcamRef.current.video;
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    // Set video width
    webcamRef.current.video.width = videoWidth;
    webcamRef.current.video.height = videoHeight;

    // Set canvas height and width
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    // Draw mesh
    const ctx = canvasRef.current.getContext("2d");
    drawRect(x, y, width, height, ctx); 
  }


  return (
    <div className="App">
      <header className="header">
        <h1>Liveness Detection</h1>
      </header>       
      {(
      <>
        <div className="webcam">
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              marginLeft: "auto",
              marginRight: "auto",
              left: 0,
              right: 0,
              textAlign: "center",
              zindex: 8,
              width: 540,
              height: 360,
              // width: 640,
              // height: 480,
            }}
          />
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
                {"Smile: " + getIsSmile(rekognizeResult)}
              </div>
              <div>
                {"Left eye x: " + getEyeLeft(rekognizeResult).x}
              </div>
              <div>
                {"Left eye y: " + getEyeLeft(rekognizeResult).y}
              </div>
              {/* <div>
                {rect(getFaceBoundingBox(rekognizeResult).Left * webcamRef.current.video.width, 
                      getFaceBoundingBox(rekognizeResult).Top * webcamRef.current.video.height,
                      getFaceBoundingBox(rekognizeResult).Width * webcamRef.current.video.width,
                      getFaceBoundingBox(rekognizeResult).Height * webcamRef.current.video.height)}
              </div> */}
              {/* <div>
                {rect(getEyeLeft(rekognizeResult).x * webcamRef.current.video.width, 
                      getEyeLeft(rekognizeResult).y * webcamRef.current.video.height)}
              </div> */}
              <div>
                {rect(getChinBottom(rekognizeResult).x * webcamRef.current.video.width - 255, 
                      getChinBottom(rekognizeResult).y * webcamRef.current.video.height - 20)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;