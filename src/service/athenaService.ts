import AWS, { AWSError } from 'aws-sdk';
import { resultSetToJson } from '../utils/dataUtils';

const athena = new AWS.Athena();

export const executeQuery = async (queryString: string) => {
    const params = {
        QueryString: queryString,
        QueryExecutionContext: {
            Database: `"gtfs-static-data-db"`,
        },
        ResultConfiguration: {
            OutputLocation: 's3://monitoring-mtl-gtfs-static/Unsaved/', // Ensure you have this bucket set up
        },
    };

    try {
        const startResponse = await athena.startQueryExecution(params).promise();

        if (startResponse?.QueryExecutionId === undefined) {
            throw new Error('Query ID is undefined');
        }

        let queryState = 'RUNNING';
        while (queryState === 'RUNNING') {
            const statusResponse = await athena
                .getQueryExecution({ QueryExecutionId: startResponse.QueryExecutionId })
                .promise();
            queryState = statusResponse.QueryExecution?.Status?.State || 'UNKNOWN';

            if (queryState === 'FAILED' || queryState === 'CANCELLED') {
                throw new Error(`Athena query ${queryState}`);
            }

            // Wait for a short time before checking the status again
            await new Promise((resolve) => setTimeout(resolve, 1000)); // polling every second
        }

        const results = await athena.getQueryResults({ QueryExecutionId: startResponse.QueryExecutionId }).promise();
        return resultSetToJson(results);
    } catch (error) {
        throw new Error(`Error executing Athena query: ${(error as AWSError).message}`);
    }
};