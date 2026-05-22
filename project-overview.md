# Mini-Jira on AWS

Live website: [https://d3oov1t31r602x.cloudfront.net](https://d3oov1t31r602x.cloudfront.net)

Demo video: [mini-jira-demo.mov](./assets/mini-jira-demo.mov)

## Architecture Diagram

![Mini-Jira on AWS high availability architecture](./assets/mini-jira-aws-architecture.jpg)

## Deployment Evidence

### IAM Roles

![AWS IAM roles for Mini-Jira](./assets/aws-iam-roles.png)

### VPC Resource Map

![AWS VPC resource map](./assets/aws-vpc-resource-map.png)

### VPC Details

![AWS VPC details](./assets/aws-vpc-details.png)

### S3 Buckets

![AWS S3 buckets for frontend, original uploads, and resized images](./assets/aws-s3-buckets.png)

### EC2 Security Groups

![AWS EC2 security groups](./assets/aws-ec2-security-groups.png)

### EC2 Instances

![AWS EC2 backend instances running across availability zones](./assets/aws-ec2-instances.png)

### Lambda Functions

![AWS Lambda functions for image resize, daily digest, and assignment worker](./assets/aws-lambda-functions.png)

### DynamoDB Tables

![AWS DynamoDB tables for Mini-Jira data](./assets/aws-dynamodb-tables.png)

### SQS Queue

![AWS SQS task assignment queue](./assets/aws-sqs-queue.png)

### CloudFront Monitoring

![AWS CloudFront monitoring page](./assets/aws-cloudfront-monitoring.png)

### CloudFront Cache Policies

![AWS CloudFront cache policies](./assets/aws-cloudfront-cache-policies.png)

### CloudFront Distribution

![AWS CloudFront distribution for Mini-Jira](./assets/aws-cloudfront-distributions.png)

### Cognito User Pool

![AWS Cognito user pool](./assets/aws-cognito-user-pool.png)

### CloudWatch Dashboard

![AWS CloudWatch backend monitoring dashboard](./assets/aws-cloudwatch-dashboard.png)

### SNS Topics

![AWS SNS topics for notifications and daily digest](./assets/aws-sns-topics.png)

### Task Assignment Notification Emails

<img src="./assets/notification-task-assigned-1.jpeg" alt="Task assignment notification email example 1" width="360">

<img src="./assets/notification-task-assigned-2.jpeg" alt="Task assignment notification email example 2" width="360">

<img src="./assets/notification-task-assigned-3.jpg" alt="Task assignment notification email example 3" width="360">

### Daily Digest Email

<img src="./assets/notification-daily-digest.jpg" alt="Daily digest notification email" width="360">
