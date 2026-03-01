# Auto-generated test module for products_api_测试
import os
from atf.core.log_manager import log
from atf.core.globals import Globals
from atf.core.variable_resolver import VariableResolver
from atf.core.request_handler import RequestHandler
from atf.core.assert_handler import AssertHandler
import allure
import yaml

@allure.epic('default')
@allure.feature('Products API')
class TestProductsApi测试:
    @classmethod
    def setup_class(cls):
        log.info('========== 开始执行测试用例：test_products_api_测试 (测试产品相关接口) ==========')
        cls.test_case_data = cls.load_test_case_data()
        cls.steps_dict = {step['id']: step for step in cls.test_case_data['steps']}
        cls.session_vars = {}
        cls.global_vars = Globals.get_data()
        cls.testcase_host = 'http://localhost:8000'
        cls.VR = VariableResolver(global_vars=cls.global_vars, session_vars=cls.session_vars)
        log.info('Setup completed for TestProductsApi测试')

    @staticmethod
    def load_test_case_data():
        yaml_path = os.path.join(os.path.dirname(__file__), '..', 'cases', 'products.yaml')
        with open(yaml_path, 'r', encoding='utf-8') as file:
            test_case_data = yaml.safe_load(file)['testcase']
        return test_case_data

    @allure.story('产品管理')
    def test_products_api_测试(self):
        log.info('Starting test_products_api_测试')
        # Step: get_products_step
        log.info(f'开始执行 step: get_products_step')
        get_products_step = self.steps_dict.get('get_products_step')
        step_host = self.testcase_host
        response = RequestHandler.send_request(
            method=get_products_step['method'],
            url=step_host + self.VR.process_data(get_products_step['path']),
            headers=self.VR.process_data(get_products_step.get('headers')),
            data=self.VR.process_data(get_products_step.get('data')),
            params=self.VR.process_data(get_products_step.get('params')),
            files=self.VR.process_data(get_products_step.get('files'))
        )
        log.info(f'get_products_step 请求结果为：{response}')
        self.session_vars['get_products_step'] = response
        db_config = None
        AssertHandler().handle_assertion(
            asserts=self.VR.process_data(get_products_step['assert']),
            response=response,
            db_config=db_config
        )

        # Step: get_featured_products_step
        log.info(f'开始执行 step: get_featured_products_step')
        get_featured_products_step = self.steps_dict.get('get_featured_products_step')
        step_host = self.testcase_host
        response = RequestHandler.send_request(
            method=get_featured_products_step['method'],
            url=step_host + self.VR.process_data(get_featured_products_step['path']),
            headers=self.VR.process_data(get_featured_products_step.get('headers')),
            data=self.VR.process_data(get_featured_products_step.get('data')),
            params=self.VR.process_data(get_featured_products_step.get('params')),
            files=self.VR.process_data(get_featured_products_step.get('files'))
        )
        log.info(f'get_featured_products_step 请求结果为：{response}')
        self.session_vars['get_featured_products_step'] = response
        db_config = None
        AssertHandler().handle_assertion(
            asserts=self.VR.process_data(get_featured_products_step['assert']),
            response=response,
            db_config=db_config
        )

        # Step: get_filter_options_step
        log.info(f'开始执行 step: get_filter_options_step')
        get_filter_options_step = self.steps_dict.get('get_filter_options_step')
        step_host = self.testcase_host
        response = RequestHandler.send_request(
            method=get_filter_options_step['method'],
            url=step_host + self.VR.process_data(get_filter_options_step['path']),
            headers=self.VR.process_data(get_filter_options_step.get('headers')),
            data=self.VR.process_data(get_filter_options_step.get('data')),
            params=self.VR.process_data(get_filter_options_step.get('params')),
            files=self.VR.process_data(get_filter_options_step.get('files'))
        )
        log.info(f'get_filter_options_step 请求结果为：{response}')
        self.session_vars['get_filter_options_step'] = response
        db_config = None
        AssertHandler().handle_assertion(
            asserts=self.VR.process_data(get_filter_options_step['assert']),
            response=response,
            db_config=db_config
        )


        log.info(f"Test case test_products_api_测试 completed.")
