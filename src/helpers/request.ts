import { ParsedUrlQueryInput } from 'querystring';
import { addQueryToUrl, appendPathnameToUrl } from 'url-transformers';
import { compactDefined, flow } from './fp';
import { ApiResponse, handleFetchResponse, HandleResponse } from './response';
import { isDefined, OmitStrict } from './typescript';

type BuildUrlParams = {
  pathname: string;
  query?: ParsedUrlQueryInput;
};

const buildUrl = ({ pathname, query = {} }: BuildUrlParams) =>
  flow(appendPathnameToUrl(pathname), addQueryToUrl(compactDefined(query)));

type FetchParams = Pick<RequestInit, 'method'>;
/**
 * The params generated by the library
 */
type BaseRequestParams = BuildUrlParams & FetchParams;

/**
 * Additional fetch options provided by the user on a per-call basis
 */
type AdditionalPerFetchParams = Omit<RequestInit, keyof FetchParams>;
type CompleteRequestParams = BaseRequestParams & AdditionalPerFetchParams;
type HandleRequest<Args> = (
  a: Args,
  additionalFetchOptions: AdditionalPerFetchParams,
) => CompleteRequestParams;

/**
 * helper used to type-check the arguments, and add default params for all requests
 */
export const createRequestHandler = <Args>(
  fn: (a: Args) => BaseRequestParams,
): HandleRequest<Args> => (a, additionalFetchOptions = {}) => ({
  ...fn(a),
  ...additionalFetchOptions,
});

/**
 * Initial parameters that apply to all calls
 */
type InitParams = {
  accessKey?: string;
  apiVersion?: string;
  apiUrl?: string;
} & OmitStrict<RequestInit, 'method' | 'body'>;

type RequestGenerator<Args, ResponseType> = {
  handleRequest: HandleRequest<Args>;
  handleResponse: HandleResponse<ResponseType>;
};

type InitMakeRequest = (
  args: InitParams,
) => <Args, ResponseType>(
  handlers: RequestGenerator<Args, ResponseType>,
) => (...a: Parameters<typeof handlers['handleRequest']>) => Promise<ApiResponse<ResponseType>>;

export const initMakeRequest: InitMakeRequest = ({
  accessKey,
  apiVersion = 'v1',
  apiUrl = 'https://api.unsplash.com',
  headers: generalHeaders,
  ...generalFetchOptions
}) => ({ handleResponse, handleRequest }) =>
  flow(
    handleRequest,
    ({ pathname, query, method = 'GET', headers: endpointHeaders, body, signal }) => {
      const url = buildUrl({ pathname, query })(apiUrl);

      const fetchOptions: RequestInit = {
        method,
        headers: {
          ...generalHeaders,
          ...endpointHeaders,
          'Accept-Version': apiVersion,
          ...(isDefined(accessKey) ? { Authorization: `Client-ID ${accessKey}` } : {}),
        },
        body,
        signal,
        ...generalFetchOptions,
      };

      return fetch(url, fetchOptions).then(handleFetchResponse(handleResponse));
    },
  );
